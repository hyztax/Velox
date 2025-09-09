window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('starfield');
    const ctx = canvas.getContext('2d');

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const stars = Array.from({ length: 200 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 1.5,
        speed: Math.random() * 0.3 + 0.1
    }));

    let mouseX = 0;

    window.addEventListener('mousemove', (e) => {
        // Normalize mouse X position from -1 to 1
        mouseX = (e.clientX / canvas.width - 0.5) * 2;
    });

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        
        stars.forEach(star => {
            // Apply horizontal mouse offset only, stronger effect
            const offsetX = mouseX * star.speed * 50; // increased multiplier

            ctx.beginPath();
            ctx.arc(star.x + offsetX, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();

            star.y -= star.speed;
            if (star.y < 0) star.y = canvas.height;
        });

        requestAnimationFrame(animate);
    }

    animate();
});
