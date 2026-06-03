document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const settingsModal = document.getElementById('settingsModal');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const apiKeyInput = document.getElementById('apiKeyInput');
    
    const novelInput = document.getElementById('novelInput');
    const clearBtn = document.getElementById('clearBtn');
    const generateBtn = document.getElementById('generateBtn');
    
    const storyboardContainer = document.getElementById('storyboardContainer');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const copyAllBtn = document.getElementById('copyAllBtn');
    const wordCountDisplay = document.getElementById('wordCount');

    // System Prompt for Gemini
    const SYSTEM_PROMPT = `You are an expert film director and AI video generation prompt engineer.
Your task is to take a raw novel/story text and break it down into a highly detailed cinematic storyboard, specifically tailored for AI video generation tools (like Runway Gen-3, Luma Dream Machine, or Midjourney + Image-to-Video).

Guidelines for breakdown:
1. Break the text into distinct, consecutive camera shots (Shot 1, Shot 2, etc.).
2. Each shot should be short (typically 3-5 seconds of action).
3. The "visual_prompt" MUST be written in English. It should be highly descriptive, including: subject description, lighting, atmosphere, cinematic style, camera angle, and background.
4. Keep the original character dialogues and sound effects in the original language of the text.

You MUST respond strictly with a valid JSON array of objects. Do not include markdown code blocks like \`\`\`json or any other text before or after the JSON array.

Format each object as follows:
{
  "shot_number": "Shot 1",
  "shot_type": "Establishing Shot / Medium Shot / Close-up / etc.",
  "scene_description": "A brief summary of what happens in this shot (in the original text language)",
  "visual_prompt": "Cinematic wide shot, dark moody lighting, rain falling, detailed, 8k... (MUST BE IN ENGLISH)",
  "camera_motion": "Slow pan right / Static / Push in / etc.",
  "audio_dialogue": "Any dialogue spoken or sound effects described in this shot"
}`;

    // Local Storage for API Key
    let geminiApiKey = localStorage.getItem('gemini_api_key') || '';
    if (geminiApiKey) {
        apiKeyInput.value = geminiApiKey;
    } else {
        // Show settings if no key exists
        settingsModal.classList.add('active');
    }

    // Modal Events
    openSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.add('active');
    });

    closeSettingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
    });

    saveSettingsBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            geminiApiKey = key;
            settingsModal.classList.remove('active');
        } else {
            alert('請輸入有效的 API Key');
        }
    });

    // Editor Events
    novelInput.addEventListener('input', () => {
        const length = novelInput.value.length;
        wordCountDisplay.textContent = length;
        if (length > 2000) {
            wordCountDisplay.style.color = '#ef4444'; // Red if > 2000
        } else {
            wordCountDisplay.style.color = '#a5b4fc'; // Default
        }
    });

    clearBtn.addEventListener('click', () => {
        novelInput.value = '';
        wordCountDisplay.textContent = '0';
        wordCountDisplay.style.color = '#a5b4fc';
    });

    // Generate Button
    generateBtn.addEventListener('click', async () => {
        const text = novelInput.value.trim();
        if (!text) {
            alert('請先輸入或貼上小說內容！');
            return;
        }

        if (!geminiApiKey) {
            alert('請先設定 Gemini API Key！');
            settingsModal.classList.add('active');
            return;
        }

        // Warn if text is too long
        if (text.length > 5000) {
            alert('您貼上的字數非常多！為了避免 AI 處理超時或輸出中斷，建議一次貼上 1000~2000 字 (大約 1~2 場戲) 為佳。系統目前會嘗試處理前段內容。');
        }

        // Show loading
        storyboardContainer.innerHTML = '';
        loadingOverlay.classList.remove('hidden');
        generateBtn.disabled = true;

        try {
            const storyboardData = await callGeminiAPI(text);
            renderStoryboard(storyboardData);
            copyAllBtn.disabled = false;
        } catch (error) {
            console.error(error);
            // Display error directly in UI instead of just alert
            storyboardContainer.innerHTML = `
                <div class="empty-state" style="color: #ef4444;">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <p><strong>生成失敗</strong></p>
                    <p style="font-size: 0.9em; margin-top: 10px;">${error.message}</p>
                    <p style="font-size: 0.85em; margin-top: 10px; color: #94a3b8;">建議：請嘗試減少貼上的文字量，每次約 1000 字左右最佳。</p>
                </div>`;
            alert('生成失敗：' + error.message);
        } finally {
            // Hide loading
            loadingOverlay.classList.add('hidden');
            generateBtn.disabled = false;
        }
    });

    // Fetch available models dynamically
    async function getAvailableModel() {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiApiKey}`;
        const response = await fetch(url);
        if (!response.ok) {
             const err = await response.json();
             throw new Error('無法取得模型清單，請確認 API Key 是否有效。' + (err.error?.message || ''));
        }
        const data = await response.json();
        
        if (data.models && data.models.length > 0) {
            console.log("可用模型清單:", data.models.map(m => m.name));
            // 尋找支援 generateContent 的 gemini 1.5 系列
            const flash = data.models.find(m => m.name.includes('gemini-1.5-flash') && m.supportedGenerationMethods?.includes('generateContent'));
            if (flash) return flash.name.replace('models/', '');
            
            const pro = data.models.find(m => m.name.includes('gemini-1.5-pro') && m.supportedGenerationMethods?.includes('generateContent'));
            if (pro) return pro.name.replace('models/', '');
            
            // 隨便找一個 gemini
            const anyGemini = data.models.find(m => m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent'));
            if (anyGemini) return anyGemini.name.replace('models/', '');
        }
        throw new Error('您的 API Key 沒有開通任何 Gemini 模型的權限。');
    }

    // Call Gemini API
    async function callGeminiAPI(text) {
        let finalPrompt = SYSTEM_PROMPT;
        let processedText = text;
        if (text.length > 2500) {
            finalPrompt += "\n\nWARNING: The input text is very long. Please ONLY generate the storyboard for the FIRST 15-20 shots to prevent output truncation. Do not attempt to process the entire text if it exceeds 15 shots.";
        }

        // 動態取得目前帳號真正可以用的模型
        const autoModel = await getAvailableModel();
        console.log("系統自動選擇模型:", autoModel);

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${autoModel}:generateContent?key=${geminiApiKey}`;
        
        let payload;
        // 如果被迫降級到舊版 (沒有 1.5)，舊版不支援 JSON 強制輸出與 systemInstruction
        if (!autoModel.includes('1.5')) {
            payload = {
                contents: [{
                    parts: [{ text: "【系統指令】\n" + finalPrompt + "\n\n【需要轉換的小說內容】\n" + processedText }]
                }],
                generationConfig: { temperature: 0.2 }
            };
        } else {
            payload = {
                contents: [{
                    parts: [{ text: processedText }]
                }],
                systemInstruction: {
                    parts: [{ text: finalPrompt }]
                },
                generationConfig: {
                    temperature: 0.2, 
                    responseMimeType: "application/json" 
                }
            };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json();
            console.error(`API Error for ${autoModel}:`, errData);
            throw new Error(errData.error?.message || 'API 請求失敗');
        }

        const data = await response.json();
        
        if (data.candidates[0].finishReason === 'SAFETY') {
            throw new Error('AI 判定內容涉及安全政策而被阻擋。');
        }

        const textResponse = data.candidates[0].content.parts[0].text;
        let jsonString = textResponse.trim();
        
        if (jsonString.startsWith('```json')) {
            jsonString = jsonString.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (jsonString.startsWith('```')) {
            jsonString = jsonString.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        if (!jsonString.endsWith(']')) {
            const lastBrace = jsonString.lastIndexOf('}');
            if (lastBrace !== -1) {
                jsonString = jsonString.substring(0, lastBrace + 1) + ']';
            } else {
                jsonString += ']';
            }
        }

        return JSON.parse(jsonString);
    }

    // Render Storyboard
    function renderStoryboard(shots) {
        storyboardContainer.innerHTML = ''; // Clear previous

        if (!Array.isArray(shots) || shots.length === 0) {
            storyboardContainer.innerHTML = `<div class="empty-state"><p>無法生成分鏡，AI 回傳的資料為空。</p></div>`;
            return;
        }

        shots.forEach((shot, index) => {
            // Add animation delay for staggered entrance
            const animationDelay = index * 0.1;
            
            const card = document.createElement('div');
            card.className = 'storyboard-card';
            card.style.animationDelay = `${animationDelay}s`;

            card.innerHTML = `
                <div class="card-header">
                    <span class="shot-number">${shot.shot_number || `Shot ${index + 1}`}</span>
                    <span class="shot-type">${shot.shot_type || 'Medium Shot'}</span>
                </div>
                
                <div class="scene-desc">
                    ${shot.scene_description || ''}
                </div>

                <div class="card-row">
                    <span class="card-label">Visual Prompt (For AI Video/Image)</span>
                    <div class="prompt-box">
                        <button class="copy-btn" title="Copy Prompt" onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent)">
                            <i class="fa-regular fa-copy"></i>
                        </button>
                        <span>${shot.visual_prompt || ''}</span>
                    </div>
                </div>

                ${shot.camera_motion ? `
                <div class="card-row">
                    <span class="card-label"><i class="fa-solid fa-video"></i> Camera Motion</span>
                    <span class="card-value">${shot.camera_motion}</span>
                </div>
                ` : ''}

                ${shot.audio_dialogue ? `
                <div class="card-row">
                    <span class="card-label"><i class="fa-solid fa-volume-high"></i> Audio / Dialogue</span>
                    <span class="card-value">${shot.audio_dialogue}</span>
                </div>
                ` : ''}
            `;

            storyboardContainer.appendChild(card);
        });
    }

    // Copy All functionality
    copyAllBtn.addEventListener('click', () => {
        const cards = document.querySelectorAll('.storyboard-card');
        if (cards.length === 0) return;

        let fullText = '';
        cards.forEach((card, i) => {
            const shotNum = card.querySelector('.shot-number').textContent;
            const prompt = card.querySelector('.prompt-box span').textContent;
            fullText += `--- ${shotNum} ---\n${prompt}\n\n`;
        });

        navigator.clipboard.writeText(fullText).then(() => {
            const originalText = copyAllBtn.innerHTML;
            copyAllBtn.innerHTML = '<i class="fa-solid fa-check"></i> 已複製';
            setTimeout(() => {
                copyAllBtn.innerHTML = originalText;
            }, 2000);
        });
    });
});
