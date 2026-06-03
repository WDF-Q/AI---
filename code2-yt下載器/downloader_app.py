import os
import threading
import sys
import customtkinter as ctk
import yt_dlp
from customtkinter import filedialog

# Set the appearance and theme
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class YouTubeDownloader(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("YT Downloader")
        self.geometry("500x420")
        self.resizable(False, False)

        # First, check if OneDrive Desktop exists, as it's the active desktop on many Windows machines.
        onedrive_desktop = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop")
        local_desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        
        if os.path.exists(onedrive_desktop):
            self.download_dir = onedrive_desktop
        elif os.path.exists(local_desktop):
            self.download_dir = local_desktop
        else:
            self.download_dir = os.path.expanduser("~") # Fallback to user home directory

        self.build_ui()

    def build_ui(self):
        # Title Label
        self.title_label = ctk.CTkLabel(self, text="YouTube 下載器", font=ctk.CTkFont(size=24, weight="bold"))
        self.title_label.pack(pady=(20, 10))

        # URL Input
        self.url_entry = ctk.CTkEntry(self, placeholder_text="貼上 YouTube 影片網址...", width=400, height=40)
        self.url_entry.pack(pady=10)

        # Format Selection
        self.format_var = ctk.StringVar(value="video")
        
        self.radio_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.radio_frame.pack(pady=5)

        self.video_radio = ctk.CTkRadioButton(self.radio_frame, text="影片 (MP4最高畫質)", variable=self.format_var, value="video")
        self.video_radio.pack(side="left", padx=15)

        self.audio_radio = ctk.CTkRadioButton(self.radio_frame, text="音樂 (MP3)", variable=self.format_var, value="audio")
        self.audio_radio.pack(side="left", padx=15)

        # Save Directory Selection
        self.dir_frame = ctk.CTkFrame(self, fg_color="transparent")
        self.dir_frame.pack(pady=10, fill="x", padx=50)

        self.dir_label = ctk.CTkLabel(self.dir_frame, text=f"儲存至: {self.download_dir}", text_color="gray", width=300, anchor="w")
        self.dir_label.pack(side="left", fill="x", expand=True)

        self.browse_btn = ctk.CTkButton(self.dir_frame, text="更改位置", width=80, command=self.choose_directory)
        self.browse_btn.pack(side="right", padx=(10, 0))

        # Download Button
        self.download_btn = ctk.CTkButton(self, text="開始下載", font=ctk.CTkFont(size=16, weight="bold"), height=45, width=200, command=self.start_download)
        self.download_btn.pack(pady=15)

        # Progress Label
        self.status_label = ctk.CTkLabel(self, text="準備就緒。", text_color="gray")
        self.status_label.pack(pady=(5, 0))

        # Progress Bar
        self.progress_bar = ctk.CTkProgressBar(self, width=400)
        self.progress_bar.set(0)
        self.progress_bar.pack(pady=10)

    def choose_directory(self):
        selected_dir = filedialog.askdirectory(title="選擇儲存資料夾", initialdir=self.download_dir)
        if selected_dir:
            self.download_dir = selected_dir
            self.dir_label.configure(text=f"儲存至: {self.download_dir}")

    def start_download(self):
        url = self.url_entry.get().strip()
        if not url:
            self.status_label.configure(text="請輸入網址！", text_color="red")
            return

        self.download_btn.configure(state="disabled", text="下載中...")
        self.browse_btn.configure(state="disabled")
        self.status_label.configure(text="正在獲取影片資訊...", text_color="orange")
        self.progress_bar.set(0)

        # Run in a separate thread to prevent UI freezing
        threading.Thread(target=self.download_process, args=(url,), daemon=True).start()

    def progress_hook(self, d):
        if d['status'] == 'downloading':
            try:
                # remove ANSI escape sequences from _percent_str
                p_str = d.get('_percent_str', '0.0%').replace('\x1b[0;94m', '').replace('\x1b[0m', '').strip()
                p_val = float(p_str.replace('%', ''))
                self.progress_bar.set(p_val / 100.0)
                
                speed = d.get('_speed_str', 'N/A')
                eta = d.get('_eta_str', 'N/A')
                self.status_label.configure(text=f"下載中: {p_str} | 速度: {speed} | 剩餘: {eta}", text_color="orange")
            except Exception as e:
                pass
        elif d['status'] == 'finished':
            self.progress_bar.set(1.0)
            self.status_label.configure(text="下載完成，正在合併檔案...", text_color="orange")

    def download_process(self, url):
        format_choice = self.format_var.get()
        
        ydl_opts = {
            'outtmpl': os.path.join(self.download_dir, '%(title)s.%(ext)s'),
            'progress_hooks': [self.progress_hook],
            'nocheckcertificate': True,
            'quiet': True,
            'no_warnings': True,
        }

        if format_choice == "video":
            ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
            ydl_opts['merge_output_format'] = 'mp4'
        else:
            ydl_opts['format'] = 'bestaudio/best'
            ydl_opts['postprocessors'] = [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '192',
            }]

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([url])
            
            # Reset UI on success
            self.after(0, self.download_complete, f"下載成功！已儲存至:\n{self.download_dir}", "green")
        except Exception as e:
            error_msg = f"下載失敗，請確認網址是否正確。"
            self.after(0, self.download_complete, error_msg, "red")

    def download_complete(self, msg, color):
        self.status_label.configure(text=msg, text_color=color)
        self.download_btn.configure(state="normal", text="開始下載")
        self.browse_btn.configure(state="normal")
        self.url_entry.delete(0, 'end')
        if color == "red":
            self.progress_bar.set(0)

if __name__ == "__main__":
    app = YouTubeDownloader()
    app.mainloop()
