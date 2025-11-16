#!/usr/bin/env python3
"""
ZenCube GUI - Graphical User Interface for ZenCube Sandbox

Author: Kamal Singh Dhami
Date: October 13, 2025
Version: 1.2 (Cross-Platform)
Description: Modern GUI for executing commands in ZenCube sandbox with resource limits
"""

import tkinter as tk
from tkinter import ttk, filedialog, messagebox, scrolledtext
import subprocess
import threading
import os
import sys
from pathlib import Path
import platform

from pathlib import Pathclass ZenCubeGUI:

    def __init__(self, root):

class ZenCubeGUI:        self.root = root

    def __init__(self, root):        self.root.title("ZenCube Sandbox - GUI Controller")

        self.root = root        self.root.geometry("1200x800")

        self.root.title("ZenCube Sandbox - GUI Controller")        self.root.minsize(900, 600)

        self.root.geometry("1200x800")        

        self.root.minsize(900, 600)        # Set color scheme

                self.bg_color = "#2b2b2b"

        # Set color scheme        self.fg_color = "#ffffff"

        self.bg_color = "#f0f0f0"        self.accent_color = "#4a9eff"

        self.fg_color = "#333333"        self.button_color = "#3d3d3d"

        self.accent_color = "#4a9eff"        

                

        

        self.cpu_enabled = tk.BooleanVar(value=False)        

        self.cpu_limit = tk.StringVar(value="5")        

                self.cpu_enabled = tk.BooleanVar(value=False)

        self.mem_enabled = tk.BooleanVar(value=False)        self.cpu_limit = tk.StringVar(value="5")

        self.mem_limit = tk.StringVar(value="256")        

                self.mem_enabled = tk.BooleanVar(value=False)

        self.procs_enabled = tk.BooleanVar(value=False)        self.mem_limit = tk.StringVar(value="256")

        self.procs_limit = tk.StringVar(value="10")        

                self.procs_enabled = tk.BooleanVar(value=False)

        self.fsize_enabled = tk.BooleanVar(value=False)        self.procs_limit = tk.StringVar(value="10")

        self.fsize_limit = tk.StringVar(value="100")        

                self.fsize_enabled = tk.BooleanVar(value=False)

        # Command and file path        self.fsize_limit = tk.StringVar(value="100")

        self.command_path = tk.StringVar(value="")        

        self.command_args = tk.StringVar(value="")        # Command and file path

                self.command_path = tk.StringVar(value="")

        # Detect platform and configure accordingly        self.command_args = tk.StringVar(value="")

        self.is_windows = platform.system() == "Windows"        

        self.use_wsl = self.is_windows  # Use WSL on Windows, native on Linux        # Detect sandbox path

                self.sandbox_path = self.detect_sandbox_path()

        # Detect sandbox path        

        self.sandbox_path = self.detect_sandbox_path()        # Create UI

                self.create_widgets()

        # Process handle        

        self.process = None        # Center window

                self.center_window()

        # Create UI    

        self.create_widgets()    def detect_sandbox_path(self):

                """Detect the sandbox binary path"""

        # Center window        possible_paths = [

        self.center_window()            "./sandbox",

                    "./zencube/sandbox",

        # Log platform info            "../zencube/sandbox",

        platform_info = "Windows (WSL)" if self.use_wsl else platform.system()            os.path.join(os.path.dirname(__file__), "sandbox")

        self.log_output(f"🖥️  Platform: {platform_info}\n", "info")        ]

        self.log_output(f"📦 Sandbox: {self.sandbox_path}\n", "info")        

        self.log_output("Ready to execute commands...\n\n", "success")        for path in possible_paths:

                if os.path.exists(path):

    def detect_sandbox_path(self):                return path

        """Detect the sandbox binary path"""        

        possible_paths = [        return "./sandbox"  # Default fallback

            "./sandbox",    

            "./zencube/sandbox",    def center_window(self):

            "../zencube/sandbox",        """Center the window on screen"""

            os.path.join(os.path.dirname(__file__), "sandbox"),        self.root.update_idletasks()

            os.path.join(os.path.dirname(__file__), "zencube", "sandbox")        width = self.root.winfo_width()

        ]        height = self.root.winfo_height()

                x = (self.root.winfo_screenwidth() // 2) - (width // 2)

        for path in possible_paths:        y = (self.root.winfo_screenheight() // 2) - (height // 2)

            if os.path.exists(path):        self.root.geometry(f'{width}x{height}+{x}+{y}')

                return path    

            def create_widgets(self):

        return "./sandbox"  # Default fallback        """Create all GUI widgets"""

            

    def center_window(self):        # Main container with padding

        """Center the window on screen"""        main_frame = ttk.Frame(self.root, padding="10")

        self.root.update_idletasks()        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        width = self.root.winfo_width()        

        height = self.root.winfo_height()        # Configure grid weights

        x = (self.root.winfo_screenwidth() // 2) - (width // 2)        self.root.columnconfigure(0, weight=1)

        y = (self.root.winfo_screenheight() // 2) - (height // 2)        self.root.rowconfigure(0, weight=1)

        self.root.geometry(f'{width}x{height}+{x}+{y}')        main_frame.columnconfigure(0, weight=1)

            main_frame.rowconfigure(3, weight=1)

    def create_widgets(self):        

        """Create all GUI widgets"""        # ===== HEADER =====

        # Main container        self.create_header(main_frame)

        main_frame = ttk.Frame(self.root, padding="10")        

        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))        # ===== FILE SELECTION SECTION =====

                self.create_file_section(main_frame)

        self.root.columnconfigure(0, weight=1)        

        self.root.rowconfigure(0, weight=1)        # ===== RESOURCE LIMITS SECTION =====

        main_frame.columnconfigure(0, weight=1)        self.create_limits_section(main_frame)

        main_frame.rowconfigure(3, weight=1)        

                # ===== OUTPUT TERMINAL SECTION =====

        # Create sections        self.create_output_section(main_frame)

        self.create_header(main_frame)        

        self.create_file_section(main_frame)        # ===== CONTROL BUTTONS =====

        self.create_limits_section(main_frame)        self.create_control_buttons(main_frame)

        self.create_output_section(main_frame)        

        self.create_control_buttons(main_frame)        # ===== STATUS BAR =====

        self.create_status_bar()        self.create_status_bar()

        

    def create_header(self, parent):    def create_header(self, parent):

        """Create header section"""        """Create header with title and logo"""

        header_frame = ttk.Frame(parent)        header_frame = ttk.Frame(parent)

        header_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))        header_frame.grid(row=0, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

                

        title_label = ttk.Label(        # Title

            header_frame,        title_label = ttk.Label(

            text="🧊 ZenCube Sandbox Controller",            header_frame,

            font=('Arial', 16, 'bold')            text="🧊 ZenCube Sandbox Controller",

        )            font=("Helvetica", 20, "bold")

        title_label.grid(row=0, column=0, sticky=tk.W)        )

                title_label.grid(row=0, column=0, sticky=tk.W)

        subtitle_label = ttk.Label(        

            header_frame,        # Subtitle

            text="Execute commands safely with resource limits",        subtitle_label = ttk.Label(

            font=('Arial', 10)            header_frame,

        )            text="Execute commands safely with resource limits",

        subtitle_label.grid(row=1, column=0, sticky=tk.W)            font=("Helvetica", 10)

            )

    def create_file_section(self, parent):        subtitle_label.grid(row=1, column=0, sticky=tk.W)

        """Create file/command selection section"""    

        file_frame = ttk.LabelFrame(parent, text="Command Selection", padding="10")    def create_file_section(self, parent):

        file_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))        """Create file selection section"""

        file_frame.columnconfigure(1, weight=1)        file_frame = ttk.LabelFrame(parent, text="Command Selection", padding="10")

                file_frame.grid(row=1, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

        # Command/File path        file_frame.columnconfigure(1, weight=1)

        ttk.Label(file_frame, text="Command/File:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))        

                # Command/File path

        command_entry = ttk.Entry(file_frame, textvariable=self.command_path, width=50)        ttk.Label(file_frame, text="Command/File:").grid(row=0, column=0, sticky=tk.W, padx=(0, 5))

        command_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=5)        

                command_entry = ttk.Entry(file_frame, textvariable=self.command_path, width=50)

        browse_btn = ttk.Button(        command_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), padx=5)

            file_frame,        

            text="Browse...",        browse_btn = ttk.Button(

            command=self.browse_file,            file_frame,

            width=12            text="Browse...",

        )            command=self.browse_file,

        browse_btn.grid(row=0, column=2, padx=5)            width=12

                )

        # Command arguments        browse_btn.grid(row=0, column=2, padx=5)

        ttk.Label(file_frame, text="Arguments:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5), pady=(10, 0))        

                # Command arguments

        args_entry = ttk.Entry(file_frame, textvariable=self.command_args, width=50)        ttk.Label(file_frame, text="Arguments:").grid(row=1, column=0, sticky=tk.W, padx=(0, 5), pady=(10, 0))

        args_entry.grid(row=1, column=1, columnspan=2, sticky=(tk.W, tk.E), padx=5, pady=(10, 0))        

                args_entry = ttk.Entry(file_frame, textvariable=self.command_args, width=50)

        # Quick commands        args_entry.grid(row=1, column=1, columnspan=2, sticky=(tk.W, tk.E), padx=5, pady=(10, 0))

        ttk.Label(file_frame, text="Quick Commands:").grid(row=2, column=0, sticky=tk.W, pady=(10, 0))        

                # Quick commands

        quick_frame = ttk.Frame(file_frame)        ttk.Label(file_frame, text="Quick Commands:").grid(row=2, column=0, sticky=tk.W, pady=(10, 0))

        quick_frame.grid(row=2, column=1, columnspan=2, sticky=tk.W, pady=(10, 0))        

                quick_frame = ttk.Frame(file_frame)

        quick_commands = [        quick_frame.grid(row=2, column=1, columnspan=2, sticky=tk.W, pady=(10, 0))

            ("/bin/ls", "-la"),        

            ("/bin/echo", "Hello ZenCube!"),        quick_commands = [

            ("/usr/bin/whoami", ""),            ("/bin/ls", "-la"),

            ("./tests/infinite_loop", ""),            ("/bin/echo", "Hello ZenCube!"),

            ("./tests/memory_hog", ""),            ("/usr/bin/whoami", ""),

        ]            ("./tests/infinite_loop", ""),

                    ("./tests/memory_hog", ""),

        for i, (cmd, args) in enumerate(quick_commands):        ]

            btn = ttk.Button(        

                quick_frame,        for i, (cmd, args) in enumerate(quick_commands):

                text=cmd.split('/')[-1],            btn = ttk.Button(

                command=lambda c=cmd, a=args: self.set_quick_command(c, a),                quick_frame,

                width=12                text=cmd.split('/')[-1],

            )                command=lambda c=cmd, a=args: self.set_quick_command(c, a),

            btn.grid(row=0, column=i, padx=2)                width=12

                )

    def create_limits_section(self, parent):            btn.grid(row=0, column=i, padx=2)

        """Create resource limits section"""    

        limits_frame = ttk.LabelFrame(parent, text="Resource Limits", padding="10")    def create_limits_section(self, parent):

        limits_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 10))        """Create resource limits section"""

        limits_frame.columnconfigure(1, weight=1)        limits_frame = ttk.LabelFrame(parent, text="Resource Limits", padding="10")

                limits_frame.grid(row=2, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

        # CPU Time Limit        

        cpu_check = ttk.Checkbutton(        # Create a grid layout for limits

            limits_frame,        limits_frame.columnconfigure(1, weight=1)

            text="CPU Time (seconds)",        limits_frame.columnconfigure(3, weight=1)

            variable=self.cpu_enabled,        

            command=self.update_limit_states        # CPU Limit

        )        cpu_check = ttk.Checkbutton(

        cpu_check.grid(row=0, column=0, sticky=tk.W, pady=5)            limits_frame,

                    text="CPU Time (seconds)",

        self.cpu_entry = ttk.Entry(limits_frame, textvariable=self.cpu_limit, width=15, state='disabled')            variable=self.cpu_enabled,

        self.cpu_entry.grid(row=0, column=1, sticky=tk.W, padx=(10, 5))            command=self.update_limit_states

                )

        ttk.Label(limits_frame, text="(Default: 5s)", foreground="gray").grid(row=0, column=2, sticky=tk.W)        cpu_check.grid(row=0, column=0, sticky=tk.W, padx=5, pady=5)

                

        # Memory Limit        self.cpu_entry = ttk.Entry(limits_frame, textvariable=self.cpu_limit, width=10, state='disabled')

        mem_check = ttk.Checkbutton(        self.cpu_entry.grid(row=0, column=1, sticky=tk.W, padx=5, pady=5)

            limits_frame,        

            text="Memory (MB)",        ttk.Label(limits_frame, text="(Default: 5s)").grid(row=0, column=2, sticky=tk.W, padx=5)

            variable=self.mem_enabled,        

            command=self.update_limit_states        # Memory Limit

        )        mem_check = ttk.Checkbutton(

        mem_check.grid(row=1, column=0, sticky=tk.W, pady=5)            limits_frame,

                    text="Memory (MB)",

        self.mem_entry = ttk.Entry(limits_frame, textvariable=self.mem_limit, width=15, state='disabled')            variable=self.mem_enabled,

        self.mem_entry.grid(row=1, column=1, sticky=tk.W, padx=(10, 5))            command=self.update_limit_states

                )

        ttk.Label(limits_frame, text="(Default: 256 MB)", foreground="gray").grid(row=1, column=2, sticky=tk.W)        mem_check.grid(row=1, column=0, sticky=tk.W, padx=5, pady=5)

                

        # Process Count Limit        self.mem_entry = ttk.Entry(limits_frame, textvariable=self.mem_limit, width=10, state='disabled')

        procs_check = ttk.Checkbutton(        self.mem_entry.grid(row=1, column=1, sticky=tk.W, padx=5, pady=5)

            limits_frame,        

            text="Max Processes",        ttk.Label(limits_frame, text="(Default: 256 MB)").grid(row=1, column=2, sticky=tk.W, padx=5)

            variable=self.procs_enabled,        

            command=self.update_limit_states        # Process Limit

        )        procs_check = ttk.Checkbutton(

        procs_check.grid(row=2, column=0, sticky=tk.W, pady=5)            limits_frame,

                    text="Max Processes",

        self.procs_entry = ttk.Entry(limits_frame, textvariable=self.procs_limit, width=15, state='disabled')            variable=self.procs_enabled,

        self.procs_entry.grid(row=2, column=1, sticky=tk.W, padx=(10, 5))            command=self.update_limit_states

                )

        ttk.Label(limits_frame, text="(Default: 10)", foreground="gray").grid(row=2, column=2, sticky=tk.W)        procs_check.grid(row=2, column=0, sticky=tk.W, padx=5, pady=5)

                

        # File Size Limit        self.procs_entry = ttk.Entry(limits_frame, textvariable=self.procs_limit, width=10, state='disabled')

        fsize_check = ttk.Checkbutton(        self.procs_entry.grid(row=2, column=1, sticky=tk.W, padx=5, pady=5)

            limits_frame,        

            text="File Size (MB)",        ttk.Label(limits_frame, text="(Default: 10)").grid(row=2, column=2, sticky=tk.W, padx=5)

            variable=self.fsize_enabled,        

            command=self.update_limit_states        # File Size Limit

        )        fsize_check = ttk.Checkbutton(

        fsize_check.grid(row=3, column=0, sticky=tk.W, pady=5)            limits_frame,

                    text="File Size (MB)",

        self.fsize_entry = ttk.Entry(limits_frame, textvariable=self.fsize_limit, width=15, state='disabled')            variable=self.fsize_enabled,

        self.fsize_entry.grid(row=3, column=1, sticky=tk.W, padx=(10, 5))            command=self.update_limit_states

                )

        ttk.Label(limits_frame, text="(Default: 100 MB)", foreground="gray").grid(row=3, column=2, sticky=tk.W)        fsize_check.grid(row=3, column=0, sticky=tk.W, padx=5, pady=5)

                

        # Presets        self.fsize_entry = ttk.Entry(limits_frame, textvariable=self.fsize_limit, width=10, state='disabled')

        preset_frame = ttk.Frame(limits_frame)        self.fsize_entry.grid(row=3, column=1, sticky=tk.W, padx=5, pady=5)

        preset_frame.grid(row=4, column=0, columnspan=3, pady=(10, 0), sticky=tk.W)        

                ttk.Label(limits_frame, text="(Default: 100 MB)").grid(row=3, column=2, sticky=tk.W, padx=5)

        ttk.Label(preset_frame, text="Presets:").grid(row=0, column=0, padx=(0, 10))        

                # Preset buttons

        ttk.Button(preset_frame, text="No Limits", command=self.preset_none, width=12).grid(row=0, column=1, padx=2)        preset_frame = ttk.Frame(limits_frame)

        ttk.Button(preset_frame, text="Light", command=self.preset_light, width=12).grid(row=0, column=2, padx=2)        preset_frame.grid(row=4, column=0, columnspan=4, sticky=tk.W, pady=(10, 0))

        ttk.Button(preset_frame, text="Medium", command=self.preset_medium, width=12).grid(row=0, column=3, padx=2)        

        ttk.Button(preset_frame, text="Strict", command=self.preset_strict, width=12).grid(row=0, column=4, padx=2)        ttk.Label(preset_frame, text="Presets:").grid(row=0, column=0, padx=(0, 10))

            

    def create_output_section(self, parent):        ttk.Button(preset_frame, text="No Limits", command=self.preset_none, width=12).grid(row=0, column=1, padx=2)

        """Create output terminal section"""        ttk.Button(preset_frame, text="Light", command=self.preset_light, width=12).grid(row=0, column=2, padx=2)

        output_frame = ttk.LabelFrame(parent, text="Output Terminal", padding="10")        ttk.Button(preset_frame, text="Medium", command=self.preset_medium, width=12).grid(row=0, column=3, padx=2)

        output_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))        ttk.Button(preset_frame, text="Strict", command=self.preset_strict, width=12).grid(row=0, column=4, padx=2)

        output_frame.columnconfigure(0, weight=1)    

        output_frame.rowconfigure(0, weight=1)    def create_output_section(self, parent):

                """Create output terminal section"""

        # Scrolled text widget        output_frame = ttk.LabelFrame(parent, text="Output Terminal", padding="10")

        self.output_text = scrolledtext.ScrolledText(        output_frame.grid(row=3, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(0, 10))

            output_frame,        output_frame.columnconfigure(0, weight=1)

            wrap=tk.WORD,        output_frame.rowconfigure(0, weight=1)

            width=100,        

            height=20,        # Create scrolled text widget

            font=('Consolas', 9),        self.output_text = scrolledtext.ScrolledText(

            bg='#1e1e1e',            output_frame,

            fg='#ffffff',            wrap=tk.WORD,

            insertbackground='white'            width=80,

        )            height=20,

        self.output_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))            font=("Courier", 10),

                    bg="#1e1e1e",

        # Configure text tags for colored output            fg="#00ff00",

        self.output_text.tag_config('error', foreground='#ff6b6b')            insertbackground="#00ff00"

        self.output_text.tag_config('success', foreground='#51cf66')        )

        self.output_text.tag_config('warning', foreground='#ffd43b')        self.output_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        self.output_text.tag_config('info', foreground='#74c0fc')        

                # Add tags for colored output

        # Initial message        self.output_text.tag_configure("error", foreground="#ff4444")

        self.log_output("🧊 ZenCube Sandbox Terminal\n", "info")        self.output_text.tag_configure("success", foreground="#44ff44")

        self.log_output("=" * 80 + "\n", "info")        self.output_text.tag_configure("warning", foreground="#ffaa00")

            self.output_text.tag_configure("info", foreground="#4a9eff")

    def create_control_buttons(self, parent):        

        """Create control buttons"""        # Initial message

        button_frame = ttk.Frame(parent)        self.log_output("🧊 ZenCube Sandbox Terminal\n", "info")

        button_frame.grid(row=4, column=0, pady=(0, 10))        self.log_output("=" * 80 + "\n", "info")

                self.log_output("Ready to execute commands. Select a file and configure limits.\n\n", "success")

        self.execute_btn = ttk.Button(    

            button_frame,    def create_control_buttons(self, parent):

            text="▶ Execute Command",        """Create control buttons"""

            command=self.execute_command,        button_frame = ttk.Frame(parent)

            width=20        button_frame.grid(row=4, column=0, sticky=(tk.W, tk.E), pady=(0, 10))

        )        

        self.execute_btn.grid(row=0, column=0, padx=5)        # Execute button (large and prominent)

                self.execute_btn = ttk.Button(

        self.stop_btn = ttk.Button(            button_frame,

            button_frame,            text="▶ Execute Command",

            text="⏹ Stop",            command=self.execute_command,

            command=self.stop_command,            width=20

            width=15,        )

            state='disabled'        self.execute_btn.grid(row=0, column=0, padx=5)

        )        

        self.stop_btn.grid(row=0, column=1, padx=5)        # Stop button

                self.stop_btn = ttk.Button(

        ttk.Button(            button_frame,

            button_frame,            text="⏹ Stop",

            text="🗑 Clear Output",            command=self.stop_execution,

            command=self.clear_output,            state='disabled',

            width=15            width=15

        ).grid(row=0, column=2, padx=5)        )

                self.stop_btn.grid(row=0, column=1, padx=5)

        ttk.Button(        

            button_frame,        # Clear output button

            text="❓ Help",        ttk.Button(

            command=self.show_help,            button_frame,

            width=15            text="🗑 Clear Output",

        ).grid(row=0, column=3, padx=5)            command=self.clear_output,

                width=15

    def create_status_bar(self):        ).grid(row=0, column=2, padx=5)

        """Create status bar at bottom"""        

        platform_text = "WSL" if self.use_wsl else "Native"        # Help button

        self.status_bar = ttk.Label(        ttk.Button(

            self.root,            button_frame,

            text=f"Ready | Platform: {platform_text} | Sandbox: {self.sandbox_path}",            text="❓ Help",

            relief=tk.SUNKEN,            command=self.show_help,

            anchor=tk.W            width=15

        )        ).grid(row=0, column=3, padx=5)

        self.status_bar.grid(row=1, column=0, sticky=(tk.W, tk.E))    

        def create_status_bar(self):

    def browse_file(self):        """Create status bar at bottom"""

        """Open file browser dialog"""        self.status_bar = ttk.Label(

        filename = filedialog.askopenfilename(            self.root,

            title="Select Command/Executable",            text=f"Ready | Sandbox: {self.sandbox_path}",

            filetypes=[            relief=tk.SUNKEN,

                ("Executables", "*"),            anchor=tk.W

                ("Shell Scripts", "*.sh"),        )

                ("Python Scripts", "*.py"),        self.status_bar.grid(row=1, column=0, sticky=(tk.W, tk.E))

                ("All Files", "*.*")    

            ]    def browse_file(self):

        )        """Open file browser dialog"""

                filename = filedialog.askopenfilename(

        if filename:            title="Select Command/Executable",

            # Warn if user selected a source file instead of executable            filetypes=[

            if filename.endswith('.c') or filename.endswith('.cpp'):                ("Executables", "*"),

                self.log_output(f"⚠️ Warning: You selected a source file ({filename})\n", "warning")                ("Shell Scripts", "*.sh"),

                self.log_output(f"💡 Tip: Select the compiled executable (without .c extension)\n", "info")                ("Python Scripts", "*.py"),

                                ("All Files", "*.*")

                # Try to suggest the executable name            ]

                executable = filename.rsplit('.', 1)[0]        )

                self.log_output(f"💡 Try selecting: {executable}\n", "info")        

                    if filename:

            self.command_path.set(filename)            # Warn if user selected a source file instead of executable

            self.log_output(f"📁 Selected file: {filename}\n", "info")            if filename.endswith('.c') or filename.endswith('.cpp'):

                            self.log_output(f"⚠️ Warning: You selected a source file ({filename})\n", "warning")

            # Show WSL path conversion (Windows only)                self.log_output(f"💡 Tip: Select the compiled executable (without .c extension)\n", "info")

            if self.use_wsl:                

                converted_path = self.convert_to_wsl_path(filename)                # Try to suggest the executable name

                if converted_path != filename:                executable = filename.rsplit('.', 1)[0]

                    self.log_output(f"🔄 WSL path: {converted_path}\n", "info")                self.log_output(f"💡 Try selecting: {executable}\n", "info")

                

    def set_quick_command(self, command, args):            self.command_path.set(filename)

        """Set a quick command"""            self.log_output(f"📁 Selected file: {filename}\n", "info")

        self.command_path.set(command)            

        self.command_args.set(args)            # Show WSL path conversion

        self.log_output(f"⚡ Quick command set: {command} {args}\n", "info")            wsl_path = self.convert_to_wsl_path(filename)

                if wsl_path != filename:

    def update_limit_states(self):                self.log_output(f"🔄 WSL path: {wsl_path}\n", "info")

        """Enable/disable limit entry fields based on checkbox state"""    

        self.cpu_entry.config(state='normal' if self.cpu_enabled.get() else 'disabled')    def set_quick_command(self, command, args):

        self.mem_entry.config(state='normal' if self.mem_enabled.get() else 'disabled')        """Set a quick command"""

        self.procs_entry.config(state='normal' if self.procs_enabled.get() else 'disabled')        self.command_path.set(command)

        self.fsize_entry.config(state='normal' if self.fsize_enabled.get() else 'disabled')        self.command_args.set(args)

            self.log_output(f"⚡ Quick command set: {command} {args}\n", "info")

    def preset_none(self):    

        """Disable all limits"""    def update_limit_states(self):

        self.cpu_enabled.set(False)        """Enable/disable entry fields based on checkboxes"""

        self.mem_enabled.set(False)        self.cpu_entry.config(state='normal' if self.cpu_enabled.get() else 'disabled')

        self.procs_enabled.set(False)        self.mem_entry.config(state='normal' if self.mem_enabled.get() else 'disabled')

        self.fsize_enabled.set(False)        self.procs_entry.config(state='normal' if self.procs_enabled.get() else 'disabled')

        self.update_limit_states()        self.fsize_entry.config(state='normal' if self.fsize_enabled.get() else 'disabled')

        self.log_output("🎯 Preset applied: No Limits\n", "info")    

        def preset_none(self):

    def preset_light(self):        """Disable all limits"""

        """Light limits preset"""        self.cpu_enabled.set(False)

        self.cpu_enabled.set(True)        self.mem_enabled.set(False)

        self.cpu_limit.set("30")        self.procs_enabled.set(False)

        self.mem_enabled.set(True)        self.fsize_enabled.set(False)

        self.mem_limit.set("1024")        self.update_limit_states()

        self.procs_enabled.set(False)        self.log_output("📋 Preset applied: No Limits\n", "info")

        self.fsize_enabled.set(False)    

        self.update_limit_states()    def preset_light(self):

        self.log_output("🎯 Preset applied: Light (CPU: 30s, Mem: 1GB)\n", "info")        """Apply light limits"""

            self.cpu_enabled.set(True)

    def preset_medium(self):        self.cpu_limit.set("30")

        """Medium limits preset"""        self.mem_enabled.set(True)

        self.cpu_enabled.set(True)        self.mem_limit.set("1024")

        self.cpu_limit.set("10")        self.procs_enabled.set(False)

        self.mem_enabled.set(True)        self.fsize_enabled.set(False)

        self.mem_limit.set("512")        self.update_limit_states()

        self.procs_enabled.set(True)        self.log_output("📋 Preset applied: Light (CPU: 30s, Memory: 1GB)\n", "info")

        self.procs_limit.set("10")    

        self.fsize_enabled.set(False)    def preset_medium(self):

        self.update_limit_states()        """Apply medium limits"""

        self.log_output("🎯 Preset applied: Medium (CPU: 10s, Mem: 512MB, Procs: 10)\n", "info")        self.cpu_enabled.set(True)

            self.cpu_limit.set("10")

    def preset_strict(self):        self.mem_enabled.set(True)

        """Strict limits preset"""        self.mem_limit.set("512")

        self.cpu_enabled.set(True)        self.procs_enabled.set(True)

        self.cpu_limit.set("5")        self.procs_limit.set("10")

        self.mem_enabled.set(True)        self.fsize_enabled.set(False)

        self.mem_limit.set("256")        self.update_limit_states()

        self.procs_enabled.set(True)        self.log_output("📋 Preset applied: Medium (CPU: 10s, Memory: 512MB, Procs: 10)\n", "info")

        self.procs_limit.set("5")    

        self.fsize_enabled.set(True)    def preset_strict(self):

        self.fsize_limit.set("50")        """Apply strict limits"""

        self.update_limit_states()        self.cpu_enabled.set(True)

        self.log_output("🎯 Preset applied: Strict (CPU: 5s, Mem: 256MB, Procs: 5, File: 50MB)\n", "info")        self.cpu_limit.set("5")

            self.mem_enabled.set(True)

    def log_output(self, message, tag=''):        self.mem_limit.set("256")

        """Log message to output terminal"""        self.procs_enabled.set(True)

        self.output_text.insert(tk.END, message, tag)        self.procs_limit.set("5")

        self.output_text.see(tk.END)        self.fsize_enabled.set(True)

        self.output_text.update()        self.fsize_limit.set("50")

            self.update_limit_states()

    def clear_output(self):        self.log_output("📋 Preset applied: Strict (All limits enabled)\n", "info")

        """Clear output terminal"""    

        self.output_text.delete(1.0, tk.END)    def log_output(self, message, tag=None):

        self.log_output("🧊 ZenCube Sandbox Terminal\n", "info")        """Add message to output terminal"""

        self.log_output("=" * 80 + "\n", "info")        self.output_text.insert(tk.END, message, tag)

        self.log_output("Output cleared.\n\n", "success")        self.output_text.see(tk.END)

            self.output_text.update()

    def convert_to_wsl_path(self, windows_path):    

        """Convert Windows path to WSL path format (only on Windows)"""    def clear_output(self):

        # On Linux, return path as-is        """Clear output terminal"""

        if not self.use_wsl:        self.output_text.delete(1.0, tk.END)

            return windows_path        self.log_output("🧊 ZenCube Sandbox Terminal\n", "info")

                self.log_output("=" * 80 + "\n", "info")

        # If it's already a relative path or starts with /, return as-is        self.log_output("Output cleared.\n\n", "success")

        if not ':' in windows_path:    

            return windows_path    def convert_to_wsl_path(self, windows_path):

                """Convert Windows path to WSL path format"""

        # Convert Windows path to WSL format        # If it's already a relative path or starts with /, return as-is

        # C:/Users/... -> /mnt/c/Users/...        if not ':' in windows_path:

        path = windows_path.replace('\\', '/')            return windows_path

                

        # Check if it's an absolute Windows path (e.g., C:/ or C:\)        # Convert Windows path to WSL format

        if len(path) > 1 and path[1] == ':':        # C:/Users/... -> /mnt/c/Users/...

            drive = path[0].lower()        path = windows_path.replace('\\', '/')

            rest = path[2:]  # Everything after "C:"        

            wsl_path = f"/mnt/{drive}{rest}"        # Check if it's an absolute Windows path (e.g., C:/ or C:\)

            return wsl_path        if len(path) > 1 and path[1] == ':':

                    drive = path[0].lower()

        return path            rest = path[2:]  # Everything after "C:"

                wsl_path = f"/mnt/{drive}{rest}"

    def build_command(self):            return wsl_path

        """Build the sandbox command with all options"""        

        command = self.command_path.get().strip()        return path

        args = self.command_args.get().strip()    

            def build_command(self):

        if not command:        """Build the sandbox command with all options"""

            raise ValueError("No command specified")        command = self.command_path.get().strip()

                args = self.command_args.get().strip()

        # Convert Windows path to WSL path if needed        

        converted_command = self.convert_to_wsl_path(command)        if not command:

                    raise ValueError("No command specified")

        # Build command based on platform        

        if self.use_wsl:        # Convert Windows path to WSL path if needed

            # Windows: Use WSL prefix        wsl_command = self.convert_to_wsl_path(command)

            cmd_parts = ["wsl", self.sandbox_path]        

        else:        # Build WSL command

            # Linux: Direct execution        cmd_parts = ["wsl", self.sandbox_path]

            cmd_parts = [self.sandbox_path]        

                # Add resource limits

        # Add resource limits        if self.cpu_enabled.get():

        if self.cpu_enabled.get():            cpu_val = self.cpu_limit.get().strip()

            cpu_val = self.cpu_limit.get().strip()            if cpu_val:

            if cpu_val:                cmd_parts.append(f"--cpu={cpu_val}")

                cmd_parts.append(f"--cpu={cpu_val}")        

                if self.mem_enabled.get():

        if self.mem_enabled.get():            mem_val = self.mem_limit.get().strip()

            mem_val = self.mem_limit.get().strip()            if mem_val:

            if mem_val:                cmd_parts.append(f"--mem={mem_val}")

                cmd_parts.append(f"--mem={mem_val}")        

                if self.procs_enabled.get():

        if self.procs_enabled.get():            procs_val = self.procs_limit.get().strip()

            procs_val = self.procs_limit.get().strip()            if procs_val:

            if procs_val:                cmd_parts.append(f"--procs={procs_val}")

                cmd_parts.append(f"--procs={procs_val}")        

                if self.fsize_enabled.get():

        if self.fsize_enabled.get():            fsize_val = self.fsize_limit.get().strip()

            fsize_val = self.fsize_limit.get().strip()            if fsize_val:

            if fsize_val:                cmd_parts.append(f"--fsize={fsize_val}")

                cmd_parts.append(f"--fsize={fsize_val}")        

                # Add command and arguments (use WSL path)

        # Add command and arguments (use converted path)        cmd_parts.append(wsl_command)

        cmd_parts.append(converted_command)        if args:

        if args:            cmd_parts.extend(args.split())

            cmd_parts.extend(args.split())        

                return cmd_parts

        return cmd_parts    

        def execute_command(self):

    def execute_command(self):        """Execute the sandbox command in a separate thread"""

        """Execute the sandbox command in a separate thread"""        try:

        try:            # Validate command before execution

            # Validate command before execution            command = self.command_path.get().strip()

            command = self.command_path.get().strip()            if not command:

            if not command:                raise ValueError("No command specified. Please enter a command or use Browse.")

                raise ValueError("No command specified. Please enter a command or use Browse.")            

                        # Check if user accidentally selected a source file

            # Check if user accidentally selected a source file            if command.endswith('.c') or command.endswith('.cpp'):

            if command.endswith('.c') or command.endswith('.cpp'):                error_msg = (

                error_msg = (                    "⚠️ Cannot execute source file!\n\n"

                    "⚠️ Cannot execute source file!\n\n"                    f"You selected: {command}\n\n"

                    f"You selected: {command}\n\n"                    "Please select the compiled executable (without .c extension).\n"

                    "Please select the compiled executable (without .c extension).\n"                    f"Try: {command.rsplit('.', 1)[0]}"

                    f"Try: {command.rsplit('.', 1)[0]}"                )

                )                messagebox.showerror("Invalid File Type", error_msg)

                messagebox.showerror("Invalid File Type", error_msg)                self.log_output(f"❌ Error: Cannot execute source file: {command}\n", "error")

                self.log_output(f"❌ Error: Cannot execute source file: {command}\n", "error")                self.log_output(f"💡 Select the executable: {command.rsplit('.', 1)[0]}\n", "info")

                self.log_output(f"💡 Select the executable: {command.rsplit('.', 1)[0]}\n", "info")                return

                return            

                        cmd_parts = self.build_command()

            cmd_parts = self.build_command()            

                        # Log command

            # Log command            self.log_output("\n" + "=" * 80 + "\n", "info")

            self.log_output("\n" + "=" * 80 + "\n", "info")            self.log_output(f"🚀 Executing: {' '.join(cmd_parts)}\n", "info")

            self.log_output(f"🚀 Executing: {' '.join(cmd_parts)}\n", "info")            self.log_output("=" * 80 + "\n", "info")

            self.log_output("=" * 80 + "\n", "info")            

                        # Update UI state

            # Update UI state            self.execute_btn.config(state='disabled')

            self.execute_btn.config(state='disabled')            self.stop_btn.config(state='normal')

            self.stop_btn.config(state='normal')            self.status_bar.config(text="Running...")

            self.status_bar.config(text="Running...")            

                        # Execute in thread

            # Execute in thread            thread = threading.Thread(target=self.run_command, args=(cmd_parts,), daemon=True)

            thread = threading.Thread(target=self.run_command, args=(cmd_parts,), daemon=True)            thread.start()

            thread.start()            

                    except ValueError as e:

        except ValueError as e:            messagebox.showerror("Error", str(e))

            messagebox.showerror("Error", str(e))            self.log_output(f"❌ Error: {e}\n", "error")

            self.log_output(f"❌ Error: {e}\n", "error")        except Exception as e:

        except Exception as e:            messagebox.showerror("Error", f"Failed to execute command: {e}")

            messagebox.showerror("Error", f"Failed to execute command: {e}")            self.log_output(f"❌ Unexpected error: {e}\n", "error")

            self.log_output(f"❌ Unexpected error: {e}\n", "error")    

        def run_command(self, cmd_parts):

    def run_command(self, cmd_parts):        """Run command in subprocess"""

        """Run command in subprocess"""        try:

        try:            self.process = subprocess.Popen(

            self.process = subprocess.Popen(                cmd_parts,

                cmd_parts,                stdout=subprocess.PIPE,

                stdout=subprocess.PIPE,                stderr=subprocess.STDOUT,

                stderr=subprocess.STDOUT,                text=True,

                text=True,                bufsize=1,

                bufsize=1,                universal_newlines=True

                universal_newlines=True            )

            )            

                        # Read output line by line

            # Read output line by line            for line in self.process.stdout:

            for line in self.process.stdout:                self.root.after(0, self.log_output, line)

                self.root.after(0, self.log_output, line)            

                        # Wait for process to complete

            # Wait for process to complete            self.process.wait()

            self.process.wait()            exit_code = self.process.returncode

            exit_code = self.process.returncode            

                        # Log completion

            # Log completion            if exit_code == 0:

            if exit_code == 0:                self.root.after(0, self.log_output, f"\n✅ Command completed successfully (exit code: {exit_code})\n", "success")

                self.root.after(0, self.log_output, f"\n✅ Command completed successfully (exit code: {exit_code})\n", "success")            else:

            else:                self.root.after(0, self.log_output, f"\n⚠️ Command exited with code: {exit_code}\n", "warning")

                self.root.after(0, self.log_output, f"\n⚠️ Command exited with code: {exit_code}\n", "warning")            

                    except Exception as e:

        except Exception as e:            self.root.after(0, self.log_output, f"\n❌ Execution error: {e}\n", "error")

            self.root.after(0, self.log_output, f"\n❌ Execution error: {e}\n", "error")        

                finally:

        finally:            # Reset UI state

            # Reset UI state            self.root.after(0, self.execute_btn.config, {'state': 'normal'})

            self.root.after(0, self.execute_btn.config, {'state': 'normal'})            self.root.after(0, self.stop_btn.config, {'state': 'disabled'})

            self.root.after(0, self.stop_btn.config, {'state': 'disabled'})            self.root.after(0, self.status_bar.config, {'text': 'Ready'})

            platform_text = "WSL" if self.use_wsl else "Native"            self.process = None

            self.root.after(0, self.status_bar.config, {'text': f"Ready | Platform: {platform_text} | Sandbox: {self.sandbox_path}"})    

            self.process = None    def stop_execution(self):

            """Stop the currently running command"""

    def stop_command(self):        if hasattr(self, 'process') and self.process:

        """Stop the running command"""            self.process.terminate()

        if self.process:            self.log_output("\n🛑 Execution stopped by user\n", "warning")

            try:            self.status_bar.config(text="Stopped")

                self.process.terminate()    

                self.log_output("\n⚠️ Process terminated by user\n", "warning")    def show_help(self):

            except Exception as e:        """Show help dialog"""

                self.log_output(f"\n❌ Error stopping process: {e}\n", "error")        help_text = """

    ZenCube Sandbox GUI - Help

    def show_help(self):

        """Show help dialog"""USAGE:

        platform_info = "Windows (WSL)" if self.use_wsl else platform.system()1. Select a command/file using the Browse button or Quick Commands

        help_text = f"""2. (Optional) Add command-line arguments

ZenCube Sandbox GUI - Help3. Enable resource limits as needed:

   - CPU Time: Limit execution time in seconds

PLATFORM: {platform_info}   - Memory: Limit memory usage in megabytes

   - Max Processes: Prevent fork bombs

USAGE:   - File Size: Limit file writes in megabytes

1. Select a command/file using the Browse button or Quick Commands4. Click "Execute Command" to run

2. (Optional) Add command-line arguments5. View output in the terminal area

3. Enable resource limits as needed:

   - CPU Time: Limit execution time in secondsPRESETS:

   - Memory: Limit memory usage in megabytes- No Limits: Run without any restrictions

   - Max Processes: Prevent fork bombs- Light: Generous limits for development

   - File Size: Limit file writes in megabytes- Medium: Balanced limits for testing

4. Click "Execute Command" to run- Strict: Tight limits for untrusted code

5. View output in the terminal area

TIPS:

PRESETS:- Use test programs in ./tests/ to verify limits

- No Limits: Run without any restrictions- Check output terminal for detailed execution logs

- Light: Generous limits for development- Use Stop button to terminate long-running processes

- Medium: Balanced limits for testing

- Strict: Tight limits for untrusted codeFor more information, see README.md

        """

TIPS:        

- Use test programs in ./tests/ to verify limits        messagebox.showinfo("ZenCube Help", help_text)

- Check output terminal for detailed execution logs

- Use Stop button to terminate long-running processesdef main():

- GUI works on both Windows (with WSL) and Linux (native)    """Main entry point"""

    root = tk.Tk()

For more information, see README.md    

        """    # Set style

        messagebox.showinfo("ZenCube GUI Help", help_text)    style = ttk.Style()

    style.theme_use('clam')

def main():    

    root = tk.Tk()    # Create app

    app = ZenCubeGUI(root)    app = ZenCubeGUI(root)

    root.mainloop()    

    # Start main loop

if __name__ == "__main__":    root.mainloop()

    main()

if __name__ == "__main__":
    main()
