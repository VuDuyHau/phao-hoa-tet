const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// 1. Khai báo biến một lần duy nhất ở đây
let W, H, centerX, centerY;
const perspective = 400; // Độ sâu trường ảnh
let aspectRatio = 1;
const PIXEL_SIZE = 4; // Độ lớn của mỗi ô pixel (bạn có thể đổi thành 2, 6, 8 tùy ý)

const FIREWORK_CONFIG = {
    explosionPower: 4.0,    // Lực nổ (Càng nhỏ pháo càng nhỏ. Thử: 2-4)
    areaScale: 2,     // 1.0 là bình thường, 2.0 là nổ rộng gấp đôi, 0.5 là nổ hẹp
    particleSize: 1.2,     // Kích cỡ hạt (Càng nhỏ hạt càng tinh tế. Thử: 1-2)
    particleCount: 180,    // Số lượng hạt mỗi quả pháo
    gravity: 0.002,         // Trọng lực rơi (Làm các hạt rơi nhanh/chậm)
    friction: 0.965,        // Lực cản không khí
    fadeSpeed: 1.01,    // Chỉ số càng nhỏ thì pháo tàn càng nhanh (Ví dụ: 0.90)
    streakLength: 1.5,      // Độ dài tia sáng (Số càng lớn tia càng dài)
    streakThreshold: 0.75   // Thời điểm chuyển từ tia thẳng sang hạt rơi (Life > 0.85 là vẽ tia)
};

const AUDIO_CONFIG = {
    music: 'snaptik.vn_PJo7H.mp3',
    launch: 'NULL.mp3',
    boom: 'NULL.mp3'
};

const SoundManager = {
    bgMusic: new Audio(AUDIO_CONFIG.music),
    launch: new Audio(AUDIO_CONFIG.launch),
    explosion: new Audio(AUDIO_CONFIG.boom),
    isInitialized: false,

    init() {
        if (this.isInitialized) return;

        // Thiết lập nhạc nền
        this.bgMusic.loop = true;
        this.bgMusic.volume = 0.4;
        
        // Phát nhạc ngay khi có tương tác
        this.bgMusic.play().then(() => {
            this.isInitialized = true;
            console.log("Âm thanh đã được kích hoạt thành công!");
            
            // Sau khi kích hoạt thành công, gỡ bỏ các bộ lắng nghe để tiết kiệm tài nguyên
            window.removeEventListener('mousemove', handleFirstInteraction);
            window.removeEventListener('click', handleFirstInteraction);
        }).catch(e => {
            // Nếu trình duyệt vẫn chặn (thường với mousemove), nó sẽ chờ cú click tiếp theo
            console.log("Trình duyệt yêu cầu click để phát nhạc");
        });
    },

    playFireworkSound(type) {
        if (!this.isInitialized) return;
        const sound = this[type].cloneNode();
        sound.volume = type === 'launch' ? 0.2 : 0.5;
        sound.play().catch(e => {});
    }
};

// Hàm trung gian để xử lý tương tác đầu tiên
function handleFirstInteraction() {
    SoundManager.init();
}

// Lắng nghe cả hai hành động: Di chuyển chuột và Click
window.addEventListener('mousemove', handleFirstInteraction);
window.addEventListener('click', handleFirstInteraction);

// Biến điều khiển đợt bắn
let lastBurstTime = 0;          // Thời điểm đợt bắn cuối cùng bắt đầu
let fireworksRemainingInBurst = 0; // Số quả pháo còn lại trong đợt hiện tại
let nextLaunchTime = 0;         // Thời điểm bắn quả pháo tiếp theo trong đợt
const BURST_INTERVAL = 3000;    // Khoảng cách giữa các đợt (VD:5000ms = 5s)


// 2. Hàm xử lý kích thước
function handleResize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;
    centerX = W / 2;
    centerY = H / 2;
    aspectRatio = W / H;
}

// 3. Khởi chạy resize
window.addEventListener('resize', handleResize);
handleResize();

// 4. Hàm project (Giữ lại để tính toán 3D)
function project(x, y, z) {
    const scale = perspective / (perspective + z);
    return {
        x: centerX + x * scale,
        y: centerY + y * scale,
        scale: scale
    };
}


// Hàm vẽ Pixel Art trên nền mượt
function drawSimulatedPixel(x, y, w, h, color) {
    const snapX = Math.round(x / PIXEL_SIZE) * PIXEL_SIZE;
    const snapY = Math.round(y / PIXEL_SIZE) * PIXEL_SIZE;
    const snapW = Math.round(w / PIXEL_SIZE) * PIXEL_SIZE;
    const snapH = Math.round(h / PIXEL_SIZE) * PIXEL_SIZE;
    ctx.fillStyle = color;
    ctx.fillRect(snapX, snapY, snapW, snapH);
}

function drawPixelPot(px, py, potW, potH, s) {
    // Thân nồi (Metallic Dithering)
    drawSimulatedPixel(px - potW/2, py, potW * 0.2, potH, '#1a252f'); 
    drawSimulatedPixel(px - potW * 0.3, py, potW * 0.4, potH, '#2c3e50');
    drawSimulatedPixel(px + potW * 0.1, py, potW * 0.3, potH, '#34495e');
    drawSimulatedPixel(px + potW * 0.25, py, PIXEL_SIZE, potH, '#5d6d7e');

    // Nắp và quai nồi
    const lidH = PIXEL_SIZE * 2;
    drawSimulatedPixel(px - potW/2 - PIXEL_SIZE, py - lidH, potW + PIXEL_SIZE * 2, lidH, '#455a64');
    drawSimulatedPixel(px - PIXEL_SIZE, py - lidH - PIXEL_SIZE * 2, PIXEL_SIZE * 2, PIXEL_SIZE * 2, '#78909c');
    
    // Quai nồi 2 bên
    const handleSize = PIXEL_SIZE * 3;
    drawSimulatedPixel(px - potW/2 - handleSize, py + potH * 0.2, handleSize, PIXEL_SIZE, '#2c3e50');
    drawSimulatedPixel(px + potW/2, py + potH * 0.2, handleSize, PIXEL_SIZE, '#34495e');
}

// Mảng chứa tất cả pháo hoa đang hoạt động
const fireworks = [];

// =====================================================
// LỚP 1: PARTICLE (Hạt phát sáng)
// =====================================================
class Particle {
    constructor(x, y, z, color, isRocket) {
        this.x = x; this.y = y; this.z = z;
        this.oldX = x; this.oldY = y; this.oldZ = z;
        this.color = color; // Dạng chuỗi "R,G,B" ví dụ "255,100,50"
        this.life = 1.0;    // Độ trong suốt (1.0 là rõ nhất, 0 là biến mất)
        this.isRocket = isRocket; // Là đầu đạn bay lên hay hạt nổ?
        this.vx = 0; this.vy = 0; this.vz = 0;
        this.gravity = 0.05;
        
        if (isRocket) {
            // Vận tốc bay lên
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -18 - Math.random() * 5;
            this.vz = (Math.random() - 0.5) * 2;
            this.gravity = 0.1;
        } else {
            // Vận tốc nổ bung ra mọi hướng ngẫu nhiên
            const speed = Math.random() * 6 + 2;
            const angle = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI; // Góc trong không gian 3D

            this.vx = speed * Math.sin(phi) * Math.cos(angle);
            this.vy = speed * Math.sin(phi) * Math.sin(angle);
            this.vz = speed * Math.cos(phi);
            this.gravity = 0.08; // Trọng lực nhẹ khi rơi
        }
    }

    update() {
        this.oldX = this.x;
        this.oldY = this.y;
        this.oldZ = this.z;
        // Áp dụng vật lý
        if (!this.isRocket) {
            this.vy += this.gravity;
            this.vx *= FIREWORK_CONFIG.friction;
            this.vy *= FIREWORK_CONFIG.friction;
            this.vz *= FIREWORK_CONFIG.friction;
            this.life *= 0.985;
        } else {
            this.vy += 0.05;
        }
        this.x += this.vx;
        this.y += this.vy;
        this.z += this.vz;

        // Giảm sự sống (mờ dần)
        this.life *= FIREWORK_CONFIG.fadeSpeed;
    }

    draw() {
        // 1. Chiếu tọa độ 3D sang 2D
        const p = project(this.x, this.y, this.z);
        const oldP = project(this.oldX, this.oldY, this.oldZ);

        // Nếu hạt ở quá xa hoặc sau camera, không vẽ
        if (p.scale <= 0 || this.life <= 0.01) return;

        ctx.beginPath();

        // --- LOGIC VẼ TIA THẲNG (STREAKS) ---
        // Nếu life còn cao (vừa mới nổ), vẽ đoạn thẳng thay vì hình tròn
        if (!this.isRocket && this.life > FIREWORK_CONFIG.streakThreshold) {
            ctx.lineWidth = FIREWORK_CONFIG.particleSize * p.scale;
            ctx.lineCap = 'round';
            ctx.strokeStyle = `rgba(${this.color}, ${this.life})`;
            
            // Vẽ đoạn thẳng từ vị trí cũ đến vị trí mới, kéo dài thêm theo streakLength
            ctx.moveTo(oldP.x, oldP.y);
            ctx.lineTo(p.x + (p.x - oldP.x) * FIREWORK_CONFIG.streakLength, 
                       p.y + (p.y - oldP.y) * FIREWORK_CONFIG.streakLength);
            ctx.stroke();
        } else {
            // Khi life thấp, chuyển sang vẽ hạt tròn rơi tan dần
            let size = (this.isRocket ? 2.5 : FIREWORK_CONFIG.particleSize * this.life) * p.scale;
            ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${this.color}, ${this.life})`;
            ctx.fill();
        }

        // Hiệu ứng phát sáng
        ctx.shadowBlur = 10 * p.scale * this.life;
        ctx.shadowColor = `rgb(${this.color})`;
        ctx.shadowBlur = 0;
    }
}

// =====================================================
// LỚP 2: FIREWORK (Quản lý quả pháo)
// =====================================================
class Firework {
    constructor() {
        const r = Math.floor(Math.random() * 200 + 55);
        const g = Math.floor(Math.random() * 200 + 55);
        const b = Math.floor(Math.random() * 200 + 55);
        this.color = `${r},${g},${b}`;

        const startZ = (Math.random() - 0.5) * 400;
        const currentScale = perspective / (perspective + startZ);
        const startX = (Math.random() - 0.5) * (W / currentScale);
        const startY = (H / 2) / currentScale; // Xuất phát từ đáy

        this.rocket = new Particle(startX, startY, startZ, this.color, true);

        // 1. Xác định vùng nổ mong muốn (Nửa trên màn hình)
        const topEdgeY = -(H / 2) / currentScale;
        this.targetY = topEdgeY * (0.6 + Math.random() * 0.3);

        // 2.Tính lực đẩy vy dựa trên quãng đường và trọng lực
        // Công thức: v = sqrt(2 * g * h)
        const gravity = 0.05; // Phải khớp với chỉ số trong Particle.update
        const distance = startY - this.targetY;
        const requiredVelocity = Math.sqrt(2 * gravity * distance);

        // Gán vận tốc bay lên (dấu âm vì bay lên trên)
        this.rocket.vy = -requiredVelocity * 1.05;

        this.exploded = false;
        this.particles = [];
        SoundManager.playFireworkSound('launch');
    }

update() {
    if (!this.exploded) {
        this.rocket.update();
        // Khi đầu đạn bay lên cao và bắt đầu rơi xuống thì cho nổ
        if (this.rocket.y <= this.targetY || this.rocket.vy >= 0) {
            this.explode();
        }
    }

    // Cập nhật các hạt đã nổ
    this.particles.forEach(p => p.update());
    // Xóa các hạt đã chết (life <= 0) để nhẹ máy
    this.particles = this.particles.filter(p => p.life > 0);
}

explode() {
    this.exploded = true;
    SoundManager.playFireworkSound('explosion');
    for (let i = 0; i < FIREWORK_CONFIG.particleCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        // Công thức phân phối điểm đồng nhất trên mặt cầu
        const phi = Math.acos(2 * Math.random() - 1);
        const speed = (0.8 + Math.random() * 0.2) * FIREWORK_CONFIG.explosionPower * FIREWORK_CONFIG.areaScale;

        const vx = speed * Math.sin(phi) * Math.cos(theta);
        const vy = speed * Math.sin(phi) * Math.sin(theta);
        const vz = speed * Math.cos(phi);

        let p = new Particle(this.rocket.x, this.rocket.y, this.rocket.z, this.color, false);
        p.vx = vx; p.vy = vy; p.vz = vz;
        p.gravity = FIREWORK_CONFIG.gravity;

        this.particles.push(p);
    }
}

draw() {
    if (!this.exploded) {
        this.rocket.draw();
    }
    this.particles.forEach(p => p.draw());
}
}

function drawStardewPot(px, py, potW, potH, s) {
    const PS = PIXEL_SIZE * s; // Kích thước hạt pixel theo độ sâu 3D

    // 1. THÂN NỒI: Sử dụng bảng màu xanh đen/xám của nồi gang Stardew
    // Chia nồi làm các dải từ tối sang sáng để tạo độ tròn trụ
    drawSimulatedPixel(px - potW/2, py, potW * 0.2, potH, '#1a202c'); // Bóng tối bên trái
    drawSimulatedPixel(px - potW * 0.3, py, potW * 0.5, potH, '#2d3748'); // Màu chủ đạo (Mid-tone)
    drawSimulatedPixel(px + potW * 0.2, py, potW * 0.3, potH, '#4a5568'); // Vùng hứng sáng bên phải
    
    // ĐIỂM NHẤN KIM LOẠI (Specular Highlight): Một đường sáng mảnh tạo cảm giác bóng loáng
    drawSimulatedPixel(px + potW * 0.3, py + PS, PS, potH - PS*2, '#718096');

    // 2. NẮP NỒI: Có vành nhô ra và núm cầm
    const lidColor = '#4a5568';
    // Vành nắp (Hơi rộng hơn thân nồi một chút)
    drawSimulatedPixel(px - potW/2 - PS, py - PS*2, potW + PS*2, PS*2, lidColor);
    // Núm nắp (Nhỏ ở giữa)
    drawSimulatedPixel(px - PS, py - PS*4, PS*2, PS*2, '#a0aec0');

    // 3. QUAI NỒI: Vẽ quai sắt hai bên (Đặc trưng Stardew)
    const handleColor = '#1a202c';
    // Quai trái
    drawSimulatedPixel(px - potW/2 - PS*2, py + potH*0.2, PS*2, PS, handleColor);
    drawSimulatedPixel(px - potW/2 - PS*3, py + potH*0.2, PS, PS*3, handleColor);
    // Quai phải
    drawSimulatedPixel(px + potW/2, py + potH*0.2, PS*2, PS, handleColor);
    drawSimulatedPixel(px + potW/2 + PS*2, py + potH*0.2, PS, PS*3, handleColor);

    // 4. HIỆU ỨNG NHIỆT: Đáy nồi hắt sắc cam từ đống lửa
    ctx.globalAlpha = 0.3;
    drawSimulatedPixel(px - potW/2, py + potH - PS*3, potW, PS*3, '#e64a19');
    ctx.globalAlpha = 1.0;
}

// Hàm vẽ mặt cắt vân gỗ chi tiết (Mô phỏng Stardew Valley)
function drawDetailedLogEnd(lx, ly, s) {
    const PS = PIXEL_SIZE * s;
    const cBark = '#3e2723', cWood = '#d7ccc8', cRings = '#8d6e63', cCenter = '#5d4037';

    // Vẽ lớp vỏ và thịt gỗ phối hợp vân vòng tuổi
    for(let i=-1; i<=2; i++) {
        for(let j=-1; j<=2; j++) {
            if ((i===-1 && j===-1) || (i===2 && j===-1) || (i===-1 && j===2) || (i===2 && j===2)) continue;
            drawSimulatedPixel(lx + i*PS, ly + j*PS, PS, PS, cBark);
        }
    }
    for(let i=0; i<=1; i++) {
        for(let j=0; j<=1; j++) {
            drawSimulatedPixel(lx + i*PS, ly + j*PS, PS, PS, cWood);
        }
    }
    drawSimulatedPixel(lx + 0*PS, ly - 1*PS, PS, PS, cRings);
    drawSimulatedPixel(lx - 1*PS, ly + 0*PS, PS, PS, cRings);
    drawSimulatedPixel(lx + 0.5*PS, ly + 0.5*PS, PS, PS, cCenter);
}

// Hàm vẽ nồi bánh chưng đổ bóng kim loại dọc (Cylindrical Shading)
function drawStardewPot(px, py, potW, potH, s) {
    const PS = PIXEL_SIZE * s;
    // Đổ bóng thân nồi từ tối sang sáng
    drawSimulatedPixel(px - potW/2, py, potW * 0.2, potH, '#1a202c'); 
    drawSimulatedPixel(px - potW * 0.3, py, potW * 0.5, potH, '#2d3748'); 
    drawSimulatedPixel(px + potW * 0.2, py, potW * 0.3, potH, '#4a5568'); 
    drawSimulatedPixel(px + potW * 0.3, py + PS, PS, potH - PS*2, '#718096'); // Điểm sáng kim loại

    // Nắp và quai nồi
    drawSimulatedPixel(px - potW/2 - PS, py - PS*2, potW + PS*2, PS*2, '#4a5568');
    drawSimulatedPixel(px - PS, py - PS*4, PS*2, PS*2, '#a0aec0');
    const hCol = '#1a202c';
    drawSimulatedPixel(px - potW/2 - PS*2, py + potH*0.2, PS*2, PS, hCol);
    drawSimulatedPixel(px + potW/2, py + potH*0.2, PS*2, PS, hCol);
}

// =====================================================
// VẼ: NỒI BÁNH CHƯNG
// =====================================================
function drawPixelStove() {
    const stoveX = -W / 3; 
    const stoveY = H / 2 - 20; 
    const stoveZ = 200; 
    const p = project(stoveX, stoveY, stoveZ);
    if (p.scale <= 0) return;

    const s = p.scale;
    const time = Date.now() * 0.005;
    const PS = PIXEL_SIZE * s;

    // --- PHẦN 1: VẼ CỦI CHI TIẾT (Xếp chồng) ---
    const drawLog = (xOff, yOff, len) => {
        const lx = p.x + xOff * s;
        const ly = p.y + yOff * s;
        const lLen = len * s;
        // Đổ bóng thân củi 3 màu
        drawSimulatedPixel(lx, ly - PS, lLen, PS, '#8d6e63');
        drawSimulatedPixel(lx, ly, lLen, PS, '#5d4037');
        drawSimulatedPixel(lx, ly + PS, lLen, PS, '#3e2723');
        drawDetailedLogEnd(lx - PS*2, ly - PS, s);
    };

    drawLog(-25, -5, 45); drawLog(15, -5, 35); // Củi nền
    drawLog(-10, 5, 50); // Củi chính phía trước

    // --- PHẦN 2: LỬA ĐA TẦNG & SPARKLES ---
    const drawFlame = (w, h, col, off) => {
        const fH = h * (0.8 + Math.sin(time * 1.5 + off) * 0.2) * s;
        const fW = w * s;
        drawSimulatedPixel(p.x - fW/2, p.y - fH - 10*s, fW, fH, col);
        drawSimulatedPixel(p.x - fW/4, p.y - fH - 20*s, fW/2, 15*s, col);
    };
    drawFlame(55, 75, '#e64a19', 0);   // Đỏ ngoài
    drawFlame(35, 50, '#f57c00', 1.5); // Cam giữa
    drawFlame(20, 30, '#fff176', 3);   // Vàng trong

    for(let i=0; i<4; i++) { // Các đốm lửa tàn nhấp nháy
        const sx = p.x + Math.sin(time*2 + i) * 35 * s;
        const sy = p.y - 50 * s - ((time * 30 + i * 25) % 80) * s;
        drawSimulatedPixel(sx, sy, PS, PS, '#fff176');
    }

    // --- PHẦN 3: NỒI BÁNH CHƯNG & KHÓI ---
    const potW = 110 * s, potH = 130 * s;
    const potY = p.y - 30 * s - potH;
    drawStardewPot(p.x, potY, potW, potH, s);

    for(let i=0; i<3; i++) { // Hơi nước bốc lên từ nắp nồi
        const off = (time * 0.5 + i * 0.8) % 2;
        const kx = p.x + Math.sin(time + i) * 15 * s;
        const ky = potY - off * 80 * s;
        if (off < 1.5) drawSimulatedPixel(kx, ky, PS*2, PS*2, `rgba(255,255,255,${0.3 - off/5})`);
    }
}

// =====================================================
// VÒNG LẶP HOẠT HÌNH CHÍNH (Animation Loop)
// =====================================================
function animate() {
    const currentTime = Date.now(); // Lấy thời gian hiện tại tính bằng miligiây
    // KỸ THUẬT TẠO ĐUÔI SÁNG (Motion Trails):
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
    ctx.fillRect(0, 0, W, H);

    //drawGround();

    drawPixelStove();

    // Ngẫu nhiên bắn pháo hoa mới
    // --- LOGIC BẮN THEO ĐỢT (BURST LOGIC) ---
    
    // 1. Kiểm tra nếu đã đến lúc bắt đầu một đợt bắn mới (mỗi 5 giây)
    if (currentTime - lastBurstTime > BURST_INTERVAL) {
        lastBurstTime = currentTime;
        // Thiết lập số lượng pháo cho đợt này (từ 20 đến 25 quả)
        fireworksRemainingInBurst = 15 + Math.floor(Math.random() * 6);
    }

    // 2. Nếu đang trong đợt bắn, tung ra từng quả pháo một cách nhịp nhàng
    if (fireworksRemainingInBurst > 0 && currentTime > nextLaunchTime) {
        fireworks.push(new Firework()); // Bắn 1 quả pháo
        fireworksRemainingInBurst--;    // Giảm số lượng còn lại trong đợt
        
        // Đặt thời gian cho quả pháo tiếp theo trong đợt (cách nhau 100-250ms)
        // Việc này giúp pháo hoa bay lên có "nhịp" chứ không ra cùng lúc
        nextLaunchTime = currentTime + 400 + Math.random() * 400;
    }

    // --- Cập nhật và vẽ pháo hoa giữ nguyên ---
    for (let i = fireworks.length - 1; i >= 0; i--) {
        fireworks[i].update();
        fireworks[i].draw();
        if (fireworks[i].exploded && fireworks[i].particles.length === 0) {
            fireworks.splice(i, 1);
        }
    }

    requestAnimationFrame(animate);
}

// Bắt đầu chạy vòng lặp
animate();