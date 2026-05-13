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

    // Several public instances to try
    const COBALT_APIS = [
        'https://cobalt.q0.wtf/',
        'https://api.cobalt.tools/' // Official is heavily rate-limited/protected
    ];

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
        
        statusText.textContent = "正在發送請求至下載伺服器...";

        try {
            const payload = {
                url: url,
                isAudioOnly: isAudio,
                aFormat: "mp3",
                vQuality: "1080"
            };

            let success = false;
            let data = null;

            // Try APIs sequentially
            for (let api of COBALT_APIS) {
                try {
                    statusText.textContent = `嘗試連接伺服器...`;
                    const response = await fetch(api, {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });

                    if (response.ok) {
                        data = await response.json();
                        success = true;
                        break;
                    }
                } catch (e) {
                    console.log(`API ${api} failed:`, e);
                    // Continue to next
                }
            }

            if (success && data) {
                if (data.status === 'error') {
                    showError(data.text || "無法處理此影片");
                } else if (data.status === 'stream' || data.status === 'redirect' || data.status === 'tunnel') {
                    showSuccess(data.url);
                } else if (data.status === 'picker') {
                    if (data.picker && data.picker.length > 0) {
                        showSuccess(data.picker[0].url);
                    } else {
                        showError("找不到可下載的檔案");
                    }
                } else {
                    showError("未知的回應格式");
                }
            } else {
                // FALLBACK: If all APIs fail (due to CORS or bot protection), redirect to the Cobalt web interface
                statusContainer.classList.add('hidden');
                resultContainer.classList.remove('hidden');
                
                // Change UI to show it's a fallback
                document.querySelector('.success-text').textContent = '伺服器繁忙，請使用備用下載頁面';
                document.querySelector('.success-icon').className = 'fa-solid fa-up-right-from-square success-icon';
                
                downloadLink.innerHTML = '<i class="fa-solid fa-external-link"></i> 前往備用下載頁面';
                downloadLink.href = `https://cobalt.tools/?url=${encodeURIComponent(url)}`;
                
                downloadBtn.disabled = false;
                downloadBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-down"></i> 開始處理';
            }

        } catch (err) {
            console.error("Critical error:", err);
            showError("發生嚴重錯誤，請重試。");
        }
    });

    function showSuccess(fileUrl) {
        statusContainer.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        
        // Reset to normal success UI
        document.querySelector('.success-text').textContent = '處理完成！';
        document.querySelector('.success-icon').className = 'fa-solid fa-circle-check success-icon';
        downloadLink.innerHTML = '<i class="fa-solid fa-download"></i> 點擊下載檔案';
        
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
