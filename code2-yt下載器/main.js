document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('download-btn');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', (e) => {
            // Optional: Add a simple animation or analytics tracking here in the future
            console.log('Download started!');
            
            // Allow the default download action to proceed
        });
    }
});
