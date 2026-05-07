import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import threading
import yt_dlp
import os

class YouTubeDownloaderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("YouTube Downloader")
        self.root.geometry("500x300")
        self.root.resizable(False, False)
        
        # UI Elements
        self.create_widgets()
        
    def create_widgets(self):
        # Title
        title_label = tk.Label(self.root, text="YouTube Video & MP3 Downloader", font=("Helvetica", 16, "bold"))
        title_label.pack(pady=15)
        
        # URL Input
        url_frame = tk.Frame(self.root)
        url_frame.pack(fill=tk.X, padx=20, pady=5)
        
        tk.Label(url_frame, text="YouTube URL:").pack(side=tk.LEFT)
        self.url_entry = tk.Entry(url_frame, width=40)
        self.url_entry.pack(side=tk.LEFT, padx=10, expand=True, fill=tk.X)
        
        # Format Selection
        format_frame = tk.Frame(self.root)
        format_frame.pack(fill=tk.X, padx=20, pady=15)
        
        tk.Label(format_frame, text="Format:").pack(side=tk.LEFT)
        self.format_var = tk.StringVar(value="video")
        tk.Radiobutton(format_frame, text="Video (MP4)", variable=self.format_var, value="video").pack(side=tk.LEFT, padx=10)
        tk.Radiobutton(format_frame, text="Audio (MP3)", variable=self.format_var, value="audio").pack(side=tk.LEFT, padx=10)
        
        # Progress Bar
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(self.root, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(fill=tk.X, padx=20, pady=10)
        
        # Status Label
        self.status_label = tk.Label(self.root, text="Ready", fg="gray")
        self.status_label.pack(pady=5)
        
        # Download Button
        self.download_btn = tk.Button(self.root, text="Download", command=self.start_download, bg="#4a6fd9", fg="white", font=("Helvetica", 10, "bold"), width=15)
        self.download_btn.pack(pady=10)

    def start_download(self):
        url = self.url_entry.get().strip()
        if not url:
            messagebox.showwarning("Warning", "Please enter a YouTube URL.")
            return
        
        # Ask for save directory
        save_dir = filedialog.askdirectory(title="Select Save Directory")
        if not save_dir:
            return
            
        self.download_btn.config(state=tk.DISABLED)
        self.status_label.config(text="Starting download...", fg="blue")
        self.progress_var.set(0)
        
        # Run in a separate thread to prevent GUI freezing
        thread = threading.Thread(target=self.download_process, args=(url, save_dir, self.format_var.get()))
        thread.daemon = True
        thread.start()

    def progress_hook(self, d):
        if d['status'] == 'downloading':
            try:
                # Calculate progress percentage
                percent_str = d.get('_percent_str', '0%').strip()
                # Remove ANSI escape codes if any
                import re
                percent_str = re.sub(r'\x1b[^m]*m', '', percent_str)
                percent = float(percent_str.replace('%', ''))
                
                self.progress_var.set(percent)
                self.status_label.config(text=f"Downloading: {percent_str} - {d.get('_speed_str', '')}")
                self.root.update_idletasks()
            except Exception:
                pass
        elif d['status'] == 'finished':
            self.progress_var.set(100)
            self.status_label.config(text="Download finished, processing...", fg="blue")
            self.root.update_idletasks()

    def download_process(self, url, save_dir, format_type):
        ydl_opts = {
            'outtmpl': os.path.join(save_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [self.progress_hook],
            'quiet': True,
            'no_warnings': True,
        }
        
        if format_type == "video":
            ydl_opts.update({
                'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            })
        else: # audio (MP3)
            ydl_opts.update({
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            })
            
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
                
            self.root.after(0, self.download_complete, True, "Download completed successfully!")
        except Exception as e:
            self.root.after(0, self.download_complete, False, str(e))

    def download_complete(self, success, message):
        self.download_btn.config(state=tk.NORMAL)
        if success:
            self.status_label.config(text="Ready", fg="gray")
            self.progress_var.set(0)
            self.url_entry.delete(0, tk.END)
            messagebox.showinfo("Success", message)
        else:
            self.status_label.config(text="Error occurred", fg="red")
            messagebox.showerror("Error", f"An error occurred during download:\n{message}")


if __name__ == "__main__":
    root = tk.Tk()
    app = YouTubeDownloaderApp(root)
    root.mainloop()
