document.addEventListener('DOMContentLoaded', () => {
    const header = document.getElementById('header');
    const headerHeight = header.offsetHeight;
    const topBanner = document.querySelector('.top-banner');
    const topBannerHeight = topBanner ? topBanner.offsetHeight : 0;

    // Sticky Header Logic
    window.addEventListener('scroll', () => {
        if (window.scrollY > topBannerHeight) {
            header.classList.add('sticky');
            // Add padding to body to prevent layout jump when header becomes fixed
            document.body.style.paddingTop = `${headerHeight}px`;
        } else {
            header.classList.remove('sticky');
            document.body.style.paddingTop = '0';
        }
    });

    // Add subtle reveal animations for product cards
    const productCards = document.querySelectorAll('.product-card');
    
    // Intersection Observer for fade-in effect on scroll
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

    productCards.forEach((card, index) => {
        // Initial state for animation
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.5s ease ${index * 0.1}s, transform 0.5s ease ${index * 0.1}s`;
        
        observer.observe(card);
    });

    // Prevent default action on empty links for demo purposes
    document.querySelectorAll('a[href="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
        });
    });
});
