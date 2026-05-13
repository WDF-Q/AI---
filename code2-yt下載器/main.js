document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('url-input');
    const downloadBtn = document.getElementById('download-btn');
    const formatRadios = document.querySelectorAll('input[name="format"]');
    
    const statusContainer = document.getElementById('status-container');
    const statusText = document.getElementById('status-text');
    
    const resultContainer = document.getElementById('result-container');
    const downloadLink = document.getElementById('download-link');
    const resetBtn = document.getElementById('reset-btn');
    
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');
    const retryBtn = document.getElementById('retry-btn');

    // API settings
    const COBALT_API_URL = 'https://api.cobalt.tools/api/json';

    downloadBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            urlInput.focus();
            return;
        }

        let isAudio = false;
        formatRadios.forEach(r => {
            if (r.checked && r.value === 'audio') {
                isAudio = true;
            }
        });

        // UI Updates
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 處理中...';
        
        statusContainer.classList.remove('hidden');
        resultContainer.classList.add('hidden');
        errorContainer.classList.add('hidden');
        
        statusText.textContent = "正在發送請求至 Cobalt 伺服器...";

        try {
            // Setup Cobalt request payload
            const payload = {
                url: url,
                isAudioOnly: isAudio,
                aFormat: isAudio ? "mp3" : "best",
                vQuality: "1080"
            };

            const response = await fetch(COBALT_API_URL, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`伺服器回應錯誤: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.status === 'error') {
                showError(data.text || "無法處理此影片");
            } else if (data.status === 'stream' || data.status === 'redirect') {
                showSuccess(data.url);
            } else if (data.status === 'picker') {
                // Handle multiple files if any
                if (data.picker && data.picker.length > 0) {
                    showSuccess(data.picker[0].url);
                } else {
                    showError("找不到可下載的檔案");
                }
            } else {
                showError("未知的回應格式");
            }

        } catch (err) {
            console.error("Fetch error:", err);
            showError("無法連接至下載伺服器或發生錯誤，請稍後再試。");
        }
    });

    function showSuccess(fileUrl) {
        statusContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        downloadLink.href = fileUrl;
        
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> 開始處理';
    }

    function showError(msg) {
        statusContainer.classList.add('hidden');
        errorContainer.classList.remove('hidden');
        errorText.textContent = msg;
        
        downloadBtn.disabled = false;
        downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> 開始處理';
    }

    resetBtn.addEventListener('click', () => {
        urlInput.value = '';
        resultContainer.classList.add('hidden');
        urlInput.focus();
    });

    retryBtn.addEventListener('click', () => {
        errorContainer.classList.add('hidden');
        downloadBtn.click();
    });
});
