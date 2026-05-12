document.addEventListener('DOMContentLoaded', () => {
    
    // 1. 導覽列滾動效果
    const header = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 2. 平滑滾動至錨點
    document.querySelectorAll('nav a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const headerHeight = header.offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
  
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. 滾動顯示動畫
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const cards = document.querySelectorAll('.photo-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `all 0.6s cubic-bezier(0.25, 0.8, 0.25, 1) ${index * 0.05}s`;
        observer.observe(card);
    });

    // 4. 價格浮現功能 (注入最新價格資料)
    const menuPrices = {
        "大食怪拼盤": { price: "NT$ 780", date: "2026/5/7更新" },
        "海雞母套餐": { price: "NT$ 360+150", date: "2026/5/7更新" },
        "石斑魚": { price: "實價", date: "2026/5/7更新" },
        "魚蛋沙拉": { price: "NT$ 200", date: "2026/5/7更新" },
        "和牛盛合": { price: "NT$ 1339", date: "2026/5/7更新" },
        "香煎鮭魚": { price: "NT$ 480", date: "2026/5/7更新" },
        "招牌毛丼": { price: "NT$ 690", date: "2026/5/7更新" },
        "新鮮生蠔": { price: "包含在餐價", date: "" },
        "波霸奶茶": { price: "包含在餐價", date: "" },
        "胡椒蝦": { price: "NT$ 330", date: "2026/5/7更新" },
        "爆蛋紅蟳鍋燒意麵": { price: "NT$ 300", date: "2026/5/7更新" },
        "什錦酸辣河粉": { price: "NT$ 200", date: "2026/5/7更新" },
        "天堂叉燒拉麵": { price: "NT$ 300", date: "2026/5/7更新" },
        "鮮甜海膽": { price: "NT$ 500", date: "2026/5/7更新" }
    };

    // 為每張卡片動態加入價格浮水印
    cards.forEach(card => {
        const foodNameElement = card.querySelector('.food-name');
        const imageWrapper = card.querySelector('.image-wrapper');
        
        if (foodNameElement && imageWrapper) {
            const foodName = foodNameElement.textContent.trim();
            const priceData = menuPrices[foodName];
            
            if (priceData) {
                const badge = document.createElement('div');
                badge.className = 'price-badge';
                
                // 如果有日期才顯示日期括號
                if (priceData.date) {
                    badge.innerHTML = `${priceData.price} <span class="date-text">(${priceData.date})</span>`;
                } else {
                    badge.innerHTML = `${priceData.price}`;
                }
                
                imageWrapper.appendChild(badge);
            }
        }
    });

    // 5. 圖片全畫面放大與點擊取消功能
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    
    // 為每張卡片的圖片綁定點擊事件
    document.querySelectorAll('.photo-card img').forEach(img => {
        // 設定游標提示
        img.style.cursor = 'zoom-in';
        
        img.addEventListener('click', (e) => {
            // 阻止事件冒泡
            e.stopPropagation(); 
            // 讀取被點擊圖片的原始路徑
            modalImg.src = img.src;
            // 顯示 Modal
            modal.classList.add('show');
        });
    });

    // 點擊放大畫面的任何地方 (包含圖片或背景)，皆關閉 Modal
    if (modal) {
        modal.addEventListener('click', () => {
            modal.classList.remove('show');
        });
    }

});
