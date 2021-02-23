import "./css/style.scss";
import * as THREE from "three";
import gsap from "gsap";
import imagesLoaded from "imagesloaded";
import FontFaceObserver from "fontfaceobserver";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import vertex from "./shaders/vertex.glsl";
import fragment from "./shaders/fragment.glsl";
import Scroll from "./js/scroll";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

export default class Sketch {
  constructor(options) {
    this.clock = new THREE.Clock();

    this.container = options.dom;
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      70,
      this.width / this.height,
      100,
      2000
    );
    this.camera.position.z = 600;

    this.camera.fov =
      2 * Math.atan(this.height / 2 / this.camera.position.z) * (180 / Math.PI);

    // Create renderer, set its sizes and append it to the container
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(this.width, this.height);
    this.container.appendChild(this.renderer.domElement);

    // Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    // Get images from DOM
    this.DOMimages = [...document.querySelectorAll("img")];

    // Load custom font
    const fontOpen = new Promise((resolve) => {
      new FontFaceObserver("Open Sans").load().then(() => {
        resolve();
      });
    });
    const fontPlayfair = new Promise((resolve) => {
      new FontFaceObserver("Playfair Display").load().then(() => {
        resolve();
      });
    });

    // Preload images
    const preloadImages = new Promise((resolve) => {
      imagesLoaded(
        document.querySelectorAll("img"),
        { background: true },
        resolve
      );
    });

    // Use bind to get the right context
    this.render = this.render.bind(this);
    this.resize = this.resize.bind(this);

    this.currentScroll = 0;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    Promise.all([fontOpen, fontPlayfair, preloadImages]).then(() => {
      this.scroll = new Scroll();

      this.resize();
      this.setupResize();

      this.addImages();
      this.setPosition();
      this.mouseMove();

      this.composerPass();
      this.render();
    });
  }

  composerPass() {
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    //custom shader pass
    var counter = 0.0;
    this.myEffect = {
      uniforms: {
        tDiffuse: { value: null },
        uScrollSpeed: { value: null },
      },
      vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix 
          * modelViewMatrix 
          * vec4( position, 1.0 );
      }
      `,
      fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uScrollSpeed;
      varying vec2 vUv;
      void main(){
        vec2 newUV = vUv;
        float area = smoothstep(0.4, 0.0, vUv.y);
        area = pow(area, 4.);
        // newUV.x += (vUv.x - 0.5) * 0.5 * vUv.y;
        newUV.x -= (vUv.x - 0.5) * 0.5 * area * uScrollSpeed;
        gl_FragColor = texture2D(tDiffuse, newUV);
        // gl_FragColor = vec4(area, 0.0, 0.0, 0.1);
      }
      `,
    };

    this.customPass = new ShaderPass(this.myEffect);
    this.customPass.renderToScreen = true;

    this.composer.addPass(this.customPass);
  }

  mouseMove() {
    window.addEventListener(
      "mousemove",
      (e) => {
        this.mouse.x = (e.clientX / this.width) * 2 - 1;
        this.mouse.y = -(e.clientY / this.height) * 2 + 1;

        // update the picking ray with the camera and mouse position
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // calculate objects intersecting the picking ray
        const intersects = this.raycaster.intersectObjects(this.scene.children);

        if (intersects.length) {
          // console.log(intersects[0]);
          const obj = intersects[0].object;
          obj.material.uniforms.uHover.value = intersects[0].uv;
        }
      },
      false
    );
  }
  setupResize() {
    window.addEventListener("resize", this.resize);
  }

  resize() {
    // Update sizes
    this.width = this.container.offsetWidth;
    this.height = this.container.offsetHeight;

    // Update camera
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    // Update renderer
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  addImages() {
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uTexture: { value: 0 },
        uHover: { value: new THREE.Vector2(0.5) },
        uHoverState: { value: 0 },
      },
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.DoubleSide,
      // wireframe: true,
    });

    this.materials = [];

    this.imgGeometries = this.DOMimages.map((DOMimg) => {
      const imgBound = DOMimg.getBoundingClientRect();
      const texture = new THREE.Texture(DOMimg);
      texture.needsUpdate = true;

      const geometry = new THREE.PlaneGeometry(1, 1, 10, 10);

      const material = this.material.clone();
      material.uniforms.uTexture.value = texture;

      this.materials.push(material);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.scale.set(imgBound.width, imgBound.height, 1);
      this.scene.add(mesh);

      DOMimg.addEventListener("mouseenter", (e) => {
        gsap.to(material.uniforms.uHoverState, {
          duration: 1,
          value: 1,
        });
      });

      DOMimg.addEventListener("mouseout", (e) => {
        gsap.to(material.uniforms.uHoverState, {
          duration: 1,
          value: 0,
        });
      });

      return {
        mesh,
        img: DOMimg,
        height: imgBound.height,
        width: imgBound.width,
        top: imgBound.top,
        left: imgBound.left,
      };
    });
  }

  // Normalize DOM coordinates system with Three.js coordinates system
  setPosition() {
    this.imgGeometries.forEach((img) => {
      img.mesh.position.x = img.left - this.width / 2 + img.width / 2;
      img.mesh.position.y =
        this.currentScroll - img.top + this.height / 2 - img.height / 2;
    });
  }

  render() {
    this.elapsedTime = this.clock.getElapsedTime();

    // Update controls for damping
    this.controls.update();

    // Sync custom control with three.js coordinates
    this.scroll.render();
    this.currentScroll = this.scroll.scrollToRender;
    this.setPosition();
    this.customPass.uniforms.uScrollSpeed.value = this.scroll.speedTarget;

    this.materials.forEach((m) => (m.uniforms.uTime.value = this.elapsedTime));

    // Render
    // this.renderer.render(this.scene, this.camera);
    this.composer.render();
    // Call tick again on the next frame
    window.requestAnimationFrame(this.render);
  }
}

new Sketch({
  dom: document.getElementById("container"),
});
