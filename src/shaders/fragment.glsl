uniform float uTime;
uniform sampler2D uTexture;
uniform float uHoverState;

varying vec2 vUv;
varying float vNoise;

void main() {

    // An other Shader hover effect
    float x = uHoverState;
	x = smoothstep(0.0, 1.0, (uHoverState * 2.0 + vUv.y - 1.0));
	vec4 f = mix(
		texture2D( uTexture, (vUv - 0.5) * (1.0 - x) + 0.5), 
		texture2D( uTexture, (vUv - 0.5) * x + 0.5), 
	    x
    );
    gl_FragColor = f;

    // Default Shader
    // vec4 oceanTexture = texture2D(uTexture, vUv);
    // gl_FragColor = oceanTexture;

    gl_FragColor.rgb += 0.05 * vec3(vNoise);
}