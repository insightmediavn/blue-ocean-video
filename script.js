document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();

    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const analyzeBtn = document.getElementById('analyze-btn');
    const uploadPrompt = document.getElementById('upload-prompt');
    const fileInfo = document.getElementById('file-info');
    const fileNameDisplay = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file-btn');
    const mainContent = document.querySelector('main');
    const headerContent = document.querySelector('header');
    const storyboardContainer = document.getElementById('storyboard-container');
    const resetBtn = document.getElementById('reset-btn');
    const exportBtn = document.getElementById('export-btn');

    const assetModal = document.getElementById('asset-modal');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const assetGrid = document.getElementById('asset-grid');
    const storyboardTbody = document.getElementById('storyboard-tbody');
    
    const translationStyleModal = document.getElementById('translation-style-modal');
    const translationStyleForm = document.getElementById('translation-style-form');
    const translationStyleInput = document.getElementById('translation-style-input');
    const targetAudienceInput = document.getElementById('target-audience-input');

    const notificationBanner = document.getElementById('notification-banner');
    const notificationMessage = document.getElementById('notification-message');
    let notificationTimeout;

    let currentFile = null;
    let selectedAssets = {};
    let storyboardData = [];
    let currentSceneId = null;
    let translationStyle = '';
    let targetAudience = '';

    function readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
    }

    const showNotification = (message, type = 'error') => {
        clearTimeout(notificationTimeout);
        notificationBanner.classList.remove('bg-red-600', 'bg-green-600', 'bg-yellow-500', 'hidden');
        
        let bgColor;
        switch (type) {
            case 'success': bgColor = 'bg-green-600'; break;
            case 'warning': bgColor = 'bg-yellow-500'; break;
            case 'error':
            default: bgColor = 'bg-red-600'; break;
        }
        notificationBanner.classList.add(bgColor);
        notificationMessage.textContent = message;

        notificationTimeout = setTimeout(() => {
            notificationBanner.classList.add('hidden');
        }, 5000);
    };

    const updateUIForFile = (file) => {
        if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
            currentFile = file;
            fileNameDisplay.textContent = file.name;
            uploadPrompt.classList.add('hidden');
            fileInfo.classList.remove('hidden');
            fileInfo.classList.add('flex');
            analyzeBtn.disabled = false;
        } else {
            resetUI();
            if (file) {
                showNotification("Vui lòng chỉ tải lên tệp có định dạng .txt", 'error');
            }
        }
    };

    const resetUI = () => {
        currentFile = null;
        fileInput.value = '';
        fileNameDisplay.textContent = '';
        uploadPrompt.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        fileInfo.classList.remove('flex');
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = 'Bắt đầu Phân tích';
        analyzeBtn.classList.remove('inline-flex', 'items-center');
    };
    
    const resetLogic = () => {
        storyboardContainer.classList.add('hidden');
        mainContent.classList.remove('hidden');
        headerContent.classList.remove('hidden');
        resetUI();
        selectedAssets = {};
        storyboardData = [];
        currentSceneId = null;
        translationStyle = '';
        targetAudience = '';
        checkExportability();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            updateUIForFile(files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            updateUIForFile(files[0]);
        }
    });

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetUI();
    });

    async function processScriptWithAI(scriptText, style, audience) {
        try {
            const response = await fetch('/api/process-script', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    scriptContent: scriptText,
                    translationStyle: style,
                    targetAudience: audience
                })
            });

            if (!response.ok) {
                const errorDetails = await response.json().catch(() => ({
                    error: "Không thể phân tích phản hồi lỗi từ máy chủ.",
                    status: response.status,
                    statusText: response.statusText
                }));
                
                console.error('Server-side Debug Error:', errorDetails);
                
                alert('Lỗi Gỡ Lỗi Phía Máy Chủ:\n\nVui lòng sao chép và gửi lại toàn bộ thông báo này cho chúng tôi:\n\n' + JSON.stringify(errorDetails, null, 2));
    
                const userFriendlyMessage = `Xử lý AI thất bại với mã lỗi: ${response.status}.`;
                throw new Error(userFriendlyMessage);
            }

            const data = await response.json();
            if (!data.choices || data.choices.length === 0) {
                throw new Error('AI returned an empty response.');
            }
            
            let content = data.choices[0].message.content;
            
            let parsedData;
            try {
                let tempParsed = JSON.parse(content);
                const keys = Object.keys(tempParsed);
                if (keys.length === 1 && Array.isArray(tempParsed[keys[0]])) {
                    parsedData = tempParsed[keys[0]];
                } else if (Array.isArray(tempParsed)) {
                    parsedData = tempParsed;
                } else {
                     throw new Error("Parsed content is not a direct array or a recognized object wrapper.");
                }
            } catch (e) {
                console.error("Failed to parse AI response:", content, e);
                throw new Error("AI returned an invalid format. Could not parse JSON.");
            }

            if (!Array.isArray(parsedData)) {
                throw new Error("AI response was not a JSON array.");
            }
            
            const originalLines = scriptText.split('\n').map(l => l.trim()).filter(Boolean);
            
            return parsedData.map((item, index) => ({
                scene: index + 1,
                vietnamese: item.vietnamese || originalLines[index] || '',
                english: item.english || '',
                keywords: item.keywords && item.keywords.length > 0 ? item.keywords : ['general', 'visual'],
                mediaSuggestion: "Video - Cảnh quay liên quan từ khóa."
            }));

        } catch (error) {
            console.error("Error during AI processing:", error);
            throw error;
        }
    }


    const generateImagePrompt = (scriptLine, keywords) => {
        const keywordString = keywords.join(', ');
        return `Create a professional image for video content based on: \"${scriptLine}\". Focus on visual elements: ${keywordString}. Style: cinematic, high-quality, suitable for YouTube video.`;
    };

    const displayStoryboard = (data) => {
        storyboardTbody.innerHTML = '';
        data.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'border-b border-gray-700 hover:bg-gray-800/60 transition-colors duration-200';
            row.dataset.sceneId = item.scene;
            
            const externalSearchLinks = item.keywords.map(kw => `
                <div class=\"flex justify-between items-center text-xs py-1\">\n                    <span class=\"text-gray-300 truncate pr-2\" title=\"${kw}\">${kw}</span>\n                    <div class=\"flex items-center gap-3 flex-shrink-0\">\n                        <a href=\"https://www.storyblocks.com/video/search/${encodeURIComponent(kw)}\" target=\"_blank\" title=\"Tìm '${kw}' trên Storyblocks\" class=\"text-orange-400 hover:text-orange-300\">\n                            <i data-lucide=\"film\" class=\"w-4 h-4\"></i>\n                        </a>\n                        <a href=\"https://www.google.com/search?q=${encodeURIComponent(kw)}\" target=\"_blank\" title=\"Tìm '${kw}' trên Google\" class=\"text-blue-400 hover:text-blue-300\">\n                            <i data-lucide=\"search\" class=\"w-4 h-4\"></i>\n                        </a>\n                    </div>\n                </div>\n            `).join('');
            
            row.innerHTML = `
                <td class=\"px-4 py-4 text-center font-medium text-gray-300\">${item.scene}</td>
                <td class=\"px-4 py-4 text-gray-300\">${item.vietnamese}</td>
                <td class=\"px-4 py-4 text-gray-400 italic\">${item.english}</td>
                <td class=\"px-4 py-4\">\n                    <div class=\"flex flex-wrap gap-2\">\n                        ${item.keywords.map(kw => `<span class=\"bg-blue-900/50 text-blue-300 text-xs font-medium px-2.5 py-1 rounded-full border border-blue-800/70\">${kw}</span>`).join('')}\n                    </div>\n                </td>\n                <td class=\"px-4 py-4 text-gray-300\">\n                    <div class=\"space-y-2\">\n                        <p>${item.mediaSuggestion}</p>\n                        <div class=\"flex gap-2\">\n                            <button data-scene-id=\"${item.scene}\" data-script=\"${item.english}\" data-keywords=\"${item.keywords.join(',')}\" class=\"generate-prompt-btn bg-purple-600 text-white text-xs font-medium py-1 px-3 rounded transition-colors hover:bg-purple-500 flex items-center gap-1\">\n                                <i data-lucide=\"sparkles\" class=\"w-3 h-3\"></i>\n                                <span>Tạo Prompt</span>\n                            </button>\n                        </div>\n                        <div id=\"prompt-display-${item.scene}\" class=\"hidden mt-2\">\n                            <textarea id=\"prompt-text-${item.scene}\" class=\"w-full text-xs bg-gray-700 text-gray-200 p-2 rounded border border-gray-600 resize-none\" rows=\"3\" readonly></textarea>\n                            <button data-prompt-target=\"prompt-text-${item.scene}\" class=\"copy-prompt-btn mt-1 text-xs text-blue-400 hover:text-blue-300\">Sao chép</button>\n                        </div>\n                    </div>\n                </td>\n                <td class=\"px-4 py-4 align-middle\">\n                    <div id=\"action-cell-${item.scene}\" class=\"flex justify-center items-center\">\n                        <div class=\"flex flex-col gap-2 w-full\">\n                            <button data-scene-id=\"${item.scene}\" data-keywords=\"${item.keywords.join(',')}\" class=\"search-assets-btn bg-green-600 text-white font-semibold py-2 px-4 rounded-lg text-sm transition-colors hover:bg-green-500 flex items-center justify-center gap-2\">\n                                <i data-lucide=\"image-down\" class=\"w-4 h-4\"></i>\n                                <span>Chọn Tư liệu</span>\n                            </button>\n                            <div class=\"mt-2 pt-2 border-t border-gray-700 space-y-1\">\n                                ${externalSearchLinks}\n                            </div>\n                        </div>\n                    </div>\n                </td>\n            `;
            storyboardTbody.appendChild(row);
        });

        lucide.createIcons();
        mainContent.classList.add('hidden');
        headerContent.classList.add('hidden');
        storyboardContainer.classList.remove('hidden');
        checkExportability();
        storyboardContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const mockSearchAssets = async (keywords) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        const keyword = (keywords.split(',')[0] || 'random').trim();
        return Array.from({ length: 10 }, (_, i) => ({
            id: `${keyword}-${i}`,
            url: `https://source.unsplash.com/random/400x300?${encodeURIComponent(keyword)}&sig=${Math.random()}`
        }));
    };

    const openAssetModal = async (keywords, sceneId) => {
        currentSceneId = sceneId;
        assetGrid.innerHTML = '<p class=\"text-gray-400 col-span-full text-center animate-pulse\">Đang tìm kiếm tư liệu...</p>';
        assetModal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');

        try {
            const assets = await mockSearchAssets(keywords);
            
            assetGrid.innerHTML = '';
            assets.forEach(asset => {
                const assetWrapper = document.createElement('div');
                assetWrapper.className = 'relative cursor-pointer group rounded-lg overflow-hidden aspect-w-4 aspect-h-3 bg-gray-700';
                assetWrapper.innerHTML = `
                    <img src=\"${asset.url}\" alt=\"Visual asset\" class=\"w-full h-full object-cover transition-transform duration-300 group-hover:scale-110\">\n                    <div class=\"absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center\">\n                        <div class=\"absolute top-2 right-2 w-6 h-6 bg-white/20 rounded-full border-2 border-white/50 flex items-center justify-center asset-checkbox transition-all\">\n                            <i data-lucide=\"check\" class=\"w-4 h-4 text-white opacity-0 transition-opacity\"></i>\n                        </div>\n                    </div>\n                `;
                assetWrapper.dataset.url = asset.url;
                assetGrid.appendChild(assetWrapper);
            });

            if (selectedAssets[currentSceneId]) {
                const selectedWrapper = assetGrid.querySelector(`[data-url=\"${selectedAssets[currentSceneId]}\"]`);
                if (selectedWrapper) {
                    const checkbox = selectedWrapper.querySelector('.asset-checkbox');
                    const icon = selectedWrapper.querySelector('[data-lucide=\"check\"]');
                    checkbox.classList.add('bg-green-500', 'border-green-500');
                    icon.classList.remove('opacity-0');
                }
            }
            lucide.createIcons();
        } catch (error) {
            console.error("Error searching for assets:", error);
            showNotification("Không thể tải tư liệu hình ảnh.", "error");
            assetGrid.innerHTML = '<p class=\"text-red-400 col-span-full text-center\">Đã xảy ra lỗi khi tìm kiếm tư liệu.</p>';
        }
    };

    const closeAssetModal = () => {
        assetModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        if (currentSceneId && selectedAssets[currentSceneId]) {
            updateActionCell(currentSceneId, selectedAssets[currentSceneId]);
        }
        currentSceneId = null;
        assetGrid.innerHTML = '';
        checkExportability();
    };
    
    const checkExportability = () => {
        if (!storyboardData || storyboardData.length === 0) {
            exportBtn.disabled = true;
            return;
        }
        const allScenesHaveAssets = storyboardData.every(scene => selectedAssets[scene.scene]);
        exportBtn.disabled = !allScenesHaveAssets;
    };

    const updateActionCell = (sceneId, imageUrl) => {
        const actionCell = document.getElementById(`action-cell-${sceneId}`);
        const row = storyboardTbody.querySelector(`tr[data-scene-id=\"${sceneId}\"]`);
        const button = row.querySelector('.search-assets-btn');
        if (!actionCell || !button) return;
        const keywords = button.dataset.keywords;

        const keywordsArray = keywords.split(',');
        const externalSearchLinks = keywordsArray.map(kw => `
            <div class=\"flex justify-between items-center text-xs py-1\">\n                <span class=\"text-gray-300 truncate pr-2\" title=\"${kw}\">${kw}</span>\n                <div class=\"flex items-center gap-3 flex-shrink-0\">\n                    <a href=\"https://www.storyblocks.com/video/search/${encodeURIComponent(kw)}\" target=\"_blank\" title=\"Tìm '${kw}' trên Storyblocks\" class=\"text-orange-400 hover:text-orange-300\">\n                        <i data-lucide=\"film\" class=\"w-4 h-4\"></i>\n                    </a>\n                    <a href=\"https://www.google.com/search?q=${encodeURIComponent(kw)}\" target=\"_blank\" title=\"Tìm '${kw}' trên Google\" class=\"text-blue-400 hover:text-blue-300\">\n                        <i data-lucide=\"search\" class=\"w-4 h-4\"></i>\n                    </a>\n                </div>\n            </div>\n        `).join('');

        actionCell.innerHTML = `
            <div class=\"flex flex-col items-center gap-2 w-full\">\n                <div class=\"relative group w-full\">\n                    <img src=\"${imageUrl}\" class=\"w-full h-24 object-cover rounded-md border-2 border-green-500\">\n                    <div class=\"absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-md\">\n                        <i data-lucide=\"check-circle-2\" class=\"w-8 h-8 text-white\"></i>\n                    </div>\n                </div>\n                <button data-scene-id=\"${sceneId}\" data-keywords=\"${keywords}\" class=\"search-assets-btn bg-blue-600 text-white w-full font-semibold py-2 px-4 rounded-lg text-sm transition-colors hover:bg-blue-500 flex items-center justify-center gap-2\">\n                    <i data-lucide=\"replace\" class=\"w-4 h-4\"></i>\n                    <span>Thay đổi</span>\n                </button>\n                <div class=\"mt-2 pt-2 border-t border-gray-700 space-y-1 w-full\">\n                    ${externalSearchLinks}\n                </div>\n            </div>\n        `;
        lucide.createIcons();
    };

    analyzeBtn.addEventListener('click', () => {
        if (currentFile) {
            translationStyleInput.value = '';
            targetAudienceInput.value = '';
            translationStyleModal.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        }
    });

    translationStyleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        translationStyle = translationStyleInput.value.trim() || 'default';
        targetAudience = targetAudienceInput.value.trim() || 'a general audience';

        translationStyleModal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');

        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = `<svg class=\"animate-spin -ml-1 mr-3 h-5 w-5 text-white\" xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\"><circle class=\"opacity-25\" cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" stroke-width=\"4\"></circle><path class=\"opacity-75\" fill=\"currentColor\" d=\"M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z\"></path></svg>Đang phân tích...`;
        analyzeBtn.classList.add('inline-flex', 'items-center');
        
        try {
            const scriptText = await readFileAsText(currentFile);
            storyboardData = await processScriptWithAI(scriptText, translationStyle, targetAudience);
            if (!storyboardData || storyboardData.length === 0) {
                showNotification("Không thể phân tích kịch bản. Vui lòng kiểm tra nội dung tệp.", "warning");
                resetUI();
                return;
            }
            displayStoryboard(storyboardData);
        } catch (error) {
            console.error("Lỗi khi đọc hoặc phân tích tệp:", error);
            showNotification(`Lỗi phân tích: ${error.message}`, "error");
            resetUI();
        }
    });
    
    translationStyleModal.addEventListener('click', (e) => {
        if (e.target === translationStyleModal) {
            translationStyleModal.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    });

    const exportEditingPackage = () => {
        if (!currentFile || !storyboardData || storyboardData.length === 0) {
            showNotification('Không có dữ liệu để xuất.', 'warning');
            return;
        }

        const fileName = currentFile.name.replace(new RegExp('\\.[^/.]+$'), '') || 'kịch_bản';

        const packageContent = `
<!DOCTYPE html>
<html lang=\"vi\">\n<head>\n    <meta charset=\"UTF-8\">\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n    <title>Gói Biên tập Video: ${fileName}</title>\n    <script src=\"https://cdn.tailwindcss.com\"></script>\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\">\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin>\n    <link href=\"https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;700&display=swap\" rel=\"stylesheet\">\n    <style>\n        body { font-family: 'Be Vietnam Pro', sans-serif; }\n        .scene-card { page-break-inside: avoid; }\n    </style>\n</head>\n<body class=\"bg-gray-100 text-gray-800 p-4 sm:p-8\">\n    <div class=\"max-w-6xl mx-auto\">\n        <header class=\"mb-8 p-4 bg-white rounded-lg shadow\">\n            <h1 class=\"text-3xl md:text-4xl font-bold text-gray-900\">Gói Biên tập Video</h1>\n            <p class=\"text-md text-gray-600 mt-1\">Kịch bản gốc: <span class=\"font-semibold\">${currentFile.name}</span></p>\n        </header>\n        \n        <main class=\"space-y-6\">\n            ${storyboardData.map(scene => `
            <div class=\"scene-card bg-white rounded-lg shadow overflow-hidden\">\n                <div class=\"bg-gray-50 px-6 py-3 border-b border-gray-200\">\n                    <h2 class=\"text-xl font-bold text-blue-700\">Phân cảnh ${scene.scene}</h2>\n                </div>\n                <div class=\"grid grid-cols-1 md:grid-cols-12 gap-6 p-6\">\n                    <div class=\"md:col-span-4\">\n                        <h3 class=\"text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2\">Tư liệu Hình ảnh</h3>\n                        <img src=\"${selectedAssets[scene.scene]}\" alt=\"Tư liệu cho phân cảnh ${scene.scene}\" class=\"rounded-lg object-cover w-full aspect-video border border-gray-200\">\n                        <p class=\"text-xs text-gray-500 mt-2 break-all\">URL: ${selectedAssets[scene.scene]}</p>\n                    </div>\n                    <div class=\"md:col-span-8 space-y-4\">\n                        <div>\n                            <h3 class=\"text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2\">Kịch bản Gốc (VI)</h3>\n                            <p class=\"text-gray-700 leading-relaxed\">${scene.vietnamese}</p>\n                        </div>\n                        <div>\n                            <h3 class=\"text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2\">Bản dịch (EN) - Voice Over</h3>\n                            <p class=\"text-gray-600 italic leading-relaxed\">${scene.english}</p>\n                        </div>\n                    </div>\n                </div>\n            </div>\n            `).join('')}\n        </main>\n\n        <footer class=\"mt-12 text-center\">\n            <p class=\"text-sm text-gray-500\">&copy; ${new Date().getFullYear()} | Tạo bởi Xưởng Sản Xuất Video Thông Minh.</p>\n        </footer>\n    </div>\n</body>\n</html>`.trim();

        const blob = new Blob([packageContent], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `goi_bien_tap_${fileName}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    resetBtn.addEventListener('click', resetLogic);
    exportBtn.addEventListener('click', exportEditingPackage);

    storyboardTbody.addEventListener('click', (e) => {
        const searchBtn = e.target.closest('.search-assets-btn');
        if (searchBtn) {
            const { sceneId, keywords } = searchBtn.dataset;
            openAssetModal(keywords, sceneId);
        }

        const generatePromptBtn = e.target.closest('.generate-prompt-btn');
        if (generatePromptBtn) {
            const { sceneId, script, keywords } = generatePromptBtn.dataset;
            const keywordArray = keywords.split(',');
            const prompt = generateImagePrompt(script, keywordArray);
            
            const promptDisplay = document.getElementById(`prompt-display-${sceneId}`);
            const promptText = document.getElementById(`prompt-text-${sceneId}`);
            
            promptText.value = prompt;
            promptDisplay.classList.remove('hidden');
            
            showNotification('Prompt đã được tạo thành công!', 'success');
        }

        const copyPromptBtn = e.target.closest('.copy-prompt-btn');
        if (copyPromptBtn) {
            const targetId = copyPromptBtn.dataset.promptTarget;
            const textArea = document.getElementById(targetId);
            
            textArea.select();
            textArea.setSelectionRange(0, 99999);
            navigator.clipboard.writeText(textArea.value).then(() => {
                showNotification('Prompt đã được sao chép vào clipboard!', 'success');
            }).catch(() => {
                showNotification('Không thể sao chép prompt. Vui lòng thử lại.', 'error');
            });
        }
    });

    assetGrid.addEventListener('click', (e) => {
        const assetWrapper = e.target.closest('[data-url]');
        if (!assetWrapper) return;
        const imageUrl = assetWrapper.dataset.url;
        selectedAssets[currentSceneId] = imageUrl;

        assetGrid.querySelectorAll('[data-url]').forEach(wrapper => {
            const checkbox = wrapper.querySelector('.asset-checkbox');
            const icon = wrapper.querySelector('[data-lucide=\"check\"]');
            checkbox.classList.remove('bg-green-500', 'border-green-500');
            icon.classList.add('opacity-0');
        });

        const checkbox = assetWrapper.querySelector('.asset-checkbox');
        const icon = assetWrapper.querySelector('[data-lucide=\"check\"]');
        checkbox.classList.add('bg-green-500', 'border-green-500');
        icon.classList.remove('opacity-0');
    });

    modalCloseBtn.addEventListener('click', closeAssetModal);
    assetModal.addEventListener('click', (e) => {
        if (e.target === assetModal) closeAssetModal();
    });

    resetUI();
});