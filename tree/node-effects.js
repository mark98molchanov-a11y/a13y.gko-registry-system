(function(global) {
  if (global.NodeEffects) {
    console.log('NodeEffects уже загружен');
    return;
  }

  class NodeEffects {
    constructor() {
      console.log('NodeEffects конструктор');
      this.activeNodes = new Map();
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      if (global.THREE) {
        this.initThreeJS();
      } else {
        console.warn('THREE не загружен, эффекты будут отключены');
      }
    }
    
    initThreeJS() {
      try {
        this.renderer = new global.THREE.WebGLRenderer({ alpha: true });
        this.renderer.setSize(1, 1);
        this.renderer.domElement.style.position = 'fixed';
        this.renderer.domElement.style.top = '0';
        this.renderer.domElement.style.pointerEvents = 'none';
        this.renderer.domElement.style.zIndex = '9999';
        document.body.appendChild(this.renderer.domElement);

        this.scene = new global.THREE.Scene();
        this.camera = new global.THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        this.camera.position.z = 5;

        this.animate();
      } catch (error) {
        console.warn('Ошибка инициализации Three.js:', error);
      }
    }
    
    animate() {
      requestAnimationFrame(() => this.animate());
      
      // Обновляем только активные эффекты
      this.activeNodes.forEach(effect => {
        if (effect.uniforms && effect.uniforms.time) {
          effect.uniforms.time.value += 0.01;
        }
      });
      
      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }
    
    addEffect(element, type) {
      if (this.activeNodes.has(element)) return;
      if (!this.scene) return;

      const rect = element.getBoundingClientRect();
      const effect = {
        type,
        mesh: this.createEffectMesh(type),
        uniforms: {
          time: { value: 0 },
          color: { value: new global.THREE.Color() }
        }
      };
      switch(type) {
        case 'absent269':
          effect.uniforms.color.value.setHex(0xff4444);
          break;
        case 'forAll':
          effect.uniforms.color.value.setHex(0x4CAF50);
          break;
        case 'subordinate':
          effect.uniforms.color.value.setHex(0x191970);
          break;
        case 'power269':
          effect.uniforms.color.value.setHex(0x9E9E9E);
          break;
      }

      effect.mesh.position.set(
        (rect.left + rect.width/2) / 50 - window.innerWidth/100,
        -(rect.top + rect.height/2) / 50 + window.innerHeight/100,
        0
      );
      this.scene.add(effect.mesh);
      this.activeNodes.set(element, effect);
    }
    
    removeEffect(element) {
      if (!this.activeNodes.has(element)) return;
      
      const effect = this.activeNodes.get(element);
      if (this.scene && effect.mesh) {
        this.scene.remove(effect.mesh);
      }
      this.activeNodes.delete(element);
    }
    
    createEffectMesh(type) {
      if (!global.THREE) return null;
      
      const geometry = new global.THREE.PlaneGeometry(2, 2);
      const material = new global.THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          uniform vec3 color;
          varying vec2 vUv;
          
          void main() {
            float pulse = sin(time * 3.0) * 0.1 + 0.9;
            float dist = distance(vUv, vec2(0.5));
            float glow = smoothstep(0.5, 0.2, dist) * pulse;
            
            gl_FragColor = vec4(color * glow, glow * 0.3);
          }
        `,
        transparent: true,
        blending: global.THREE.AdditiveBlending
      });
      return new global.THREE.Mesh(geometry, material);
    }
  }

  global.NodeEffects = NodeEffects;
  console.log('✅ NodeEffects загружен в глобальную область');

})(window);
