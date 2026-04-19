// ========== 3D TO'LQINLI FON ==========
(function() {
    const canvas = document.getElementById('wave-canvas');
    if (!canvas) return;
    
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        console.warn("WebGL2 qo'llab-quvvatlanmaydi");
        return;
    }
    
    const vertexShaderSource = `#version 300 es
    in vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }`;
    
    const fragmentShaderSource = `#version 300 es
    precision highp float;
    out vec4 O;
    uniform float time;
    uniform vec2 resolution;
    
    #define FC gl_FragCoord.xy
    #define R resolution
    #define T time
    #define S smoothstep
    #define N normalize
    #define MN min(R.x,R.y)
    #define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
    #define PI radians(180.)
    
    float box(vec3 p, vec3 s, float r) {
        p = abs(p) - s + r;
        return length(max(p, 0.0)) + min(0.0, max(max(p.x, p.y), p.z)) - r;
    }
    
    float map(vec3 p) {
        p.y = abs(p.y) - 2.875;
        p.y -= sin(T * 2.0 - p.z * 0.25) * 2.75;
        p.xz *= rot(PI / 4.0);
        float d = box(p, vec3(10.0, 0.1, 10.0), 0.005);
        return d * 0.5;
    }
    
    bool march(inout vec3 p, vec3 rd) {
        for (int i = 0; i < 400; i++) {
            float d = map(p);
            if (abs(d) < 1e-2) return true;
            if (d > 40.0) return false;
            p += rd * d;
        }
        return false;
    }
    
    vec3 norm(vec3 p) {
        float h = 1e-2;
        vec2 k = vec2(-1, 1);
        return N(
            k.xyy * map(p + k.xyy * h) +
            k.yxy * map(p + k.yxy * h) +
            k.yyx * map(p + k.yyx * h) +
            k.xxx * map(p + k.xxx * h)
        );
    }
    
    float shadow(vec3 p, vec3 lp) {
        float shd = 1.0, maxd = length(lp - p);
        vec3 l = N(lp - p);
        for (float i = 1e-2; i < maxd;) {
            float d = map(p + l * i);
            if (abs(d) < 1e-2) {
                shd = 0.0;
                break;
            }
            shd = min(shd, 128.0 * d / i);
            i += d;
        }
        return shd;
    }
    
    float calcAO(vec3 p, vec3 n) {
        float occ = 0.0, sca = 1.0;
        for (float i = 0.0; i < 5.0; i++) {
            float h = 0.01 + i * 0.09;
            float d = map(p + h * n);
            occ += (h - d) * sca;
            sca *= 0.55;
            if (occ > 0.35) break;
        }
        return clamp(1.0 - 3.0 * occ, 0.0, 1.0) * (0.5 + 0.5 * n.y);
    }
    
   vec3 render(vec2 uv) {
    vec3 col = vec3(0);  // 1 dan 0 ga o'zgartirildi
    vec3 p = vec3(0, 0, -30);
    vec3 rd = N(vec3(uv, 1));
    if (march(p, rd)) {
        col = vec3(0);
        vec3 n = norm(p);
        vec3 lp = vec3(0, 10, -20);
        vec3 l = N(lp - p);
        float dif = clamp(dot(l, n), 0.0, 1.0);
        float ao = calcAO(p, n);
        float shd = shadow(p + n * 5e-2, lp);
        float spe = pow(clamp(dot(reflect(rd, n), l), 0.0, 1.0), 15.0);
        float fre = pow(clamp(1.0 + dot(rd, n), 0.0, 1.0), 5.0);
        col += 0.5 + dif * dif * shd * ao;
        col = mix(spe * vec3(1), col, fre);
        col = tanh(col * col);
        col = pow(col, vec3(0.4545));
    }
    return col;
}

void main() {
    vec2 uv = (FC - 0.5 * R) / MN;
    vec3 col = render(uv);
    col = clamp(col, 0.0, 1.0);
    col = vec3(1.0) - col;  // Qora fon, oq to'lqinlar
    O = vec4(col, 1.0);
}
    
    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error(gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }
    
    const vs = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vs || !fs) return;
    
    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return;
    }
    
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    
    const positionLoc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);
    
    const timeLoc = gl.getUniformLocation(program, 'time');
    const resolutionLoc = gl.getUniformLocation(program, 'resolution');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    
    let startTime = performance.now() / 1000;
    
    function render() {
        const currentTime = (performance.now() / 1000) - startTime;
        gl.useProgram(program);
        gl.uniform1f(timeLoc, currentTime);
        gl.uniform2f(resolutionLoc, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        requestAnimationFrame(render);
    }
    
    window.addEventListener('resize', resize);
    resize();
    render();
})();const products = [
    { id: 1, name: "Klassik futbolka", price: 120000, image: "https://picsum.photos/id/20/300/300" },
    { id: 2, name: "Jinsi shim", price: 250000, image: "https://picsum.photos/id/21/300/300" },
    { id: 3, name: "Sport kostyum", price: 350000, image: "https://picsum.photos/id/22/300/300" },
    { id: 4, name: "Qishki sviter", price: 180000, image: "https://picsum.photos/id/23/300/300" },
    { id: 5, name: "Zamonaviy ko'ylak", price: 220000, image: "https://picsum.photos/id/24/300/300" },
    { id: 6, name: "Krasovkalar", price: 300000, image: "https://picsum.photos/id/25/300/300" }
];

let cart = JSON.parse(localStorage.getItem('novair_cart')) || [];

function saveCart() {
    localStorage.setItem('novair_cart', JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const cartCountElem = document.getElementById('cartCount');
    if (cartCountElem) {
        cartCountElem.innerText = cart.length;
    }
}

function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        cart.push(product);
        saveCart();
        alert(`${product.name} savatga qo'shildi!`);
    }
}

function displayProducts() {
    const container = document.getElementById('products');
    if (!container) return;
    
    container.innerHTML = '';
    
    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <img src="${product.image}" alt="${product.name}">
            <h3>${product.name}</h3>
            <div class="price">${product.price.toLocaleString()} so'm</div>
            <button onclick="addToCart(${product.id})">🛍️ Savatga qo'shish</button>
        `;
        container.appendChild(card);
    });
}

function scrollToProducts() {
    document.querySelector('.products').scrollIntoView({ behavior: 'smooth' });
}

displayProducts();
updateCartCount();
