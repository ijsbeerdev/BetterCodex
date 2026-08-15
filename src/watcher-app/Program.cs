using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Microsoft.Win32;

[assembly: AssemblyTitle("BetterCodex Manager")]
[assembly: AssemblyProduct("BetterCodex")]
[assembly: AssemblyCompany("BetterCodex")]
[assembly: AssemblyDescription("Launch watcher and status manager for BetterCodex")]

namespace BetterCodex.Manager
{
    internal static class Program
    {
        internal const string MutexName = @"Local\BetterCodexManager";
        internal const string ShutdownEventName = @"Local\BetterCodexManagerShutdown";

        [STAThread]
        private static int Main(string[] args)
        {
            if (HasArgument(args, "--shutdown")) return SignalShutdown();

            bool createdNew;
            using (var mutex = new Mutex(true, MutexName, out createdNew))
            {
                if (!createdNew) return 0;
                bool shutdownCreated;
                using (var shutdown = new EventWaitHandle(false, EventResetMode.ManualReset, ShutdownEventName, out shutdownCreated))
                {
                    if (!shutdownCreated) shutdown.Reset();
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    Application.Run(new ManagerContext(shutdown, HasArgument(args, "--startup"), HasArgument(args, "--resume-update")));
                }
                mutex.ReleaseMutex();
            }
            return 0;
        }

        private static bool HasArgument(string[] args, string expected)
        {
            foreach (string value in args)
                if (string.Equals(value, expected, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        private static int SignalShutdown()
        {
            try
            {
                using (EventWaitHandle shutdown = EventWaitHandle.OpenExisting(ShutdownEventName)) shutdown.Set();
            }
            catch (WaitHandleCannotBeOpenedException) { return 0; }

            DateTime deadline = DateTime.UtcNow.AddSeconds(10);
            while (DateTime.UtcNow < deadline)
            {
                try
                {
                    using (Mutex mutex = Mutex.OpenExisting(MutexName))
                    {
                        if (mutex.WaitOne(250)) { mutex.ReleaseMutex(); return 0; }
                    }
                }
                catch (WaitHandleCannotBeOpenedException) { return 0; }
                catch (AbandonedMutexException) { return 0; }
            }
            return 1;
        }
    }

    internal sealed class ManagerContext : ApplicationContext
    {
        private const string RunKeyPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string RunValueName = "BetterCodex";
        private readonly string runtimeRoot = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        private readonly string dataRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BetterCodex");
        private readonly string settingsRoot = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "BetterCodex");
        private readonly EventWaitHandle shutdown;
        private readonly NotifyIcon tray;
        private readonly ToolStripMenuItem statusItem;
        private readonly ToolStripMenuItem pauseItem;
        private readonly ToolStripMenuItem startupItem;
        private readonly System.Windows.Forms.Timer timer;
        private readonly JavaScriptSerializer json = new JavaScriptSerializer();
        private Process watcher;
        private DateTime nextWatcherStart = DateTime.MinValue;
        private string lastState = "starting";
        private bool closing;

        internal ManagerContext(EventWaitHandle shutdownEvent, bool startedAtLogin, bool resumeAfterUpdate)
        {
            shutdown = shutdownEvent;
            Directory.CreateDirectory(dataRoot);
            Directory.CreateDirectory(settingsRoot);

            statusItem = new ToolStripMenuItem("Starting BetterCodex…");
            statusItem.Enabled = false;
            statusItem.Font = new Font(SystemFonts.MenuFont, FontStyle.Bold);

            pauseItem = new ToolStripMenuItem("Pause automatic enhancement");
            pauseItem.Click += delegate { TogglePaused(); };

            startupItem = new ToolStripMenuItem("Start with Windows");
            startupItem.Checked = IsStartupEnabled();
            startupItem.Click += delegate { SetStartupEnabled(!startupItem.Checked); };

            var menu = new ContextMenuStrip();
            menu.Items.Add(statusItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(Item("Open Codex with BetterCodex", delegate { OpenCodex(); }));
            menu.Items.Add(Item("Restart BetterCodex runtime", delegate { SendCommand("restart-runtime"); }));
            menu.Items.Add(pauseItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(Item("Open diagnostics log", delegate { OpenLog(); }));
            menu.Items.Add(Item("Open install folder", delegate { OpenPath(runtimeRoot); }));
            menu.Items.Add(Item("Check for updates", delegate { OpenPath("https://github.com/ijsbeerdev/BetterCodex/releases/latest"); }));
            menu.Items.Add(startupItem);
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(Item("Exit BetterCodex", delegate { ExitManager(); }));

            tray = new NotifyIcon();
            tray.Icon = SystemIcons.Application;
            tray.Text = "BetterCodex — starting";
            tray.ContextMenuStrip = menu;
            tray.Visible = true;
            tray.DoubleClick += delegate { OpenCodex(); };

            StartWatcher();
            if (resumeAfterUpdate) OpenCodex();
            timer = new System.Windows.Forms.Timer();
            timer.Interval = 1000;
            timer.Tick += delegate { Tick(); };
            timer.Start();
            if (resumeAfterUpdate) tray.ShowBalloonTip(2500, "BetterCodex updated", "The latest release is installed and Codex is reopening.", ToolTipIcon.Info);
            else if (!startedAtLogin) tray.ShowBalloonTip(2000, "BetterCodex", "Watching for ChatGPT Codex launches.", ToolTipIcon.Info);
        }

        private static ToolStripMenuItem Item(string text, EventHandler click)
        {
            var item = new ToolStripMenuItem(text);
            item.Click += click;
            return item;
        }

        private string StatusPath { get { return Path.Combine(dataRoot, "watcher-status.json"); } }
        private string CommandPath { get { return Path.Combine(dataRoot, "watcher-command.json"); } }
        private string SettingsPath { get { return Path.Combine(settingsRoot, "watcher-settings.json"); } }
        private string LogPath { get { return Path.Combine(dataRoot, "Logs", "bettercodex.log"); } }

        private void StartWatcher()
        {
            if (closing || DateTime.UtcNow < nextWatcherStart) return;
            string watcherPath = Path.Combine(runtimeRoot, "watcher.ps1");
            if (!File.Exists(watcherPath))
            {
                SetStatus("error", "The BetterCodex watcher is missing.");
                return;
            }
            try
            {
                var info = new ProcessStartInfo();
                info.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\WindowsPowerShell\v1.0\powershell.exe");
                info.Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + watcherPath + "\" -Managed";
                info.WorkingDirectory = runtimeRoot;
                info.UseShellExecute = false;
                info.CreateNoWindow = true;
                info.WindowStyle = ProcessWindowStyle.Hidden;
                watcher = Process.Start(info);
                nextWatcherStart = DateTime.UtcNow.AddSeconds(3);
            }
            catch (Exception error)
            {
                AppendManagerLog("Could not start watcher: " + error.Message);
                SetStatus("error", "Could not start the BetterCodex watcher.");
                nextWatcherStart = DateTime.UtcNow.AddSeconds(10);
            }
        }

        private void Tick()
        {
            if (shutdown.WaitOne(0)) { ExitManager(); return; }
            if (watcher == null || watcher.HasExited) StartWatcher();
            ReadStatus();
        }

        private void ReadStatus()
        {
            try
            {
                if (!File.Exists(StatusPath)) { SetStatus("starting", "Starting the launch watcher…"); return; }
                var values = json.DeserializeObject(File.ReadAllText(StatusPath, Encoding.UTF8)) as Dictionary<string, object>;
                if (values == null) return;
                string state = values.ContainsKey("state") ? Convert.ToString(values["state"]) : "starting";
                string message = values.ContainsKey("message") ? Convert.ToString(values["message"]) : "Watching for Codex.";
                bool paused = values.ContainsKey("paused") && Convert.ToBoolean(values["paused"]);
                pauseItem.Checked = paused;
                pauseItem.Text = paused ? "Resume automatic enhancement" : "Pause automatic enhancement";
                SetStatus(state, message);
            }
            catch (Exception error) { AppendManagerLog("Could not read watcher status: " + error.Message); }
        }

        private void SetStatus(string state, string message)
        {
            statusItem.Text = message;
            string tooltip = "BetterCodex — " + message;
            tray.Text = tooltip.Length > 63 ? tooltip.Substring(0, 63) : tooltip;
            if ((state == "error" || state == "degraded") && state != lastState)
                tray.ShowBalloonTip(4000, "BetterCodex needs attention", message, ToolTipIcon.Warning);
            lastState = state;
        }

        private void TogglePaused()
        {
            bool paused = !ReadPaused();
            WriteJson(SettingsPath, new Dictionary<string, object> { { "paused", paused }, { "updatedAt", DateTime.UtcNow.ToString("o") } });
            pauseItem.Checked = paused;
            pauseItem.Text = paused ? "Resume automatic enhancement" : "Pause automatic enhancement";
            SetStatus(paused ? "paused" : "ready", paused ? "Automatic Codex enhancement is paused." : "Watching for Codex.");
        }

        private bool ReadPaused()
        {
            try
            {
                if (!File.Exists(SettingsPath)) return false;
                var values = json.DeserializeObject(File.ReadAllText(SettingsPath, Encoding.UTF8)) as Dictionary<string, object>;
                return values != null && values.ContainsKey("paused") && Convert.ToBoolean(values["paused"]);
            }
            catch { return false; }
        }

        private void SendCommand(string action)
        {
            WriteJson(CommandPath, new Dictionary<string, object> { { "action", action }, { "createdAt", DateTime.UtcNow.ToString("o") } });
        }

        private void WriteJson(string path, object value)
        {
            string temporary = path + "." + Process.GetCurrentProcess().Id + ".tmp";
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            File.WriteAllText(temporary, json.Serialize(value), new UTF8Encoding(false));
            if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
        }

        private void OpenCodex()
        {
            string startPath = Path.Combine(runtimeRoot, "start.ps1");
            var info = new ProcessStartInfo();
            info.FileName = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), @"System32\WindowsPowerShell\v1.0\powershell.exe");
            info.Arguments = "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"" + startPath + "\"";
            info.WorkingDirectory = runtimeRoot;
            info.UseShellExecute = false;
            info.CreateNoWindow = true;
            Process.Start(info);
        }

        private void OpenLog()
        {
            Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
            if (!File.Exists(LogPath)) File.WriteAllText(LogPath, "BetterCodex diagnostics log\r\n", Encoding.UTF8);
            OpenPath(LogPath);
        }

        private static void OpenPath(string path)
        {
            Process.Start(new ProcessStartInfo(path) { UseShellExecute = true });
        }

        private bool IsStartupEnabled()
        {
            using (RegistryKey key = Registry.CurrentUser.OpenSubKey(RunKeyPath))
                return key != null && key.GetValue(RunValueName) != null;
        }

        private void SetStartupEnabled(bool enabled)
        {
            using (RegistryKey key = Registry.CurrentUser.CreateSubKey(RunKeyPath))
            {
                if (enabled) key.SetValue(RunValueName, "\"" + Assembly.GetExecutingAssembly().Location + "\" --startup", RegistryValueKind.String);
                else key.DeleteValue(RunValueName, false);
            }
            startupItem.Checked = enabled;
        }

        private void AppendManagerLog(string message)
        {
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(LogPath));
                File.AppendAllText(LogPath, DateTime.UtcNow.ToString("o") + " [manager] " + message + Environment.NewLine, Encoding.UTF8);
            }
            catch { }
        }

        private void ExitManager()
        {
            if (closing) return;
            closing = true;
            timer.Stop();
            try
            {
                if (watcher != null && !watcher.HasExited) watcher.Kill();
            }
            catch { }
            tray.Visible = false;
            tray.Dispose();
            ExitThread();
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                timer.Dispose();
                if (watcher != null) watcher.Dispose();
            }
            base.Dispose(disposing);
        }
    }
}
