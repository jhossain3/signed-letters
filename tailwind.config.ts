import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		fontFamily: {
  			serif: [
  				'Cormorant Garamond',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			sans: [
  				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif',
  				'Apple Color Emoji',
  				'Segoe UI Emoji',
  				'Segoe UI Symbol',
  				'Noto Color Emoji'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			]
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			pastel: {
  				cream: 'hsl(var(--pastel-cream))',
  				sand: 'hsl(var(--pastel-sand))',
  				sage: 'hsl(var(--pastel-sage))',
  				mist: 'hsl(var(--pastel-mist))',
  				sky: 'hsl(var(--pastel-sky))',
  				lavender: 'hsl(var(--pastel-lavender))',
  				stone: 'hsl(var(--pastel-stone))'
  			},
  			envelope: {
  				cream: 'hsl(var(--envelope-cream))',
  				shadow: 'hsl(var(--envelope-shadow))'
  			},
  			seal: {
  				DEFAULT: 'hsl(var(--seal-warm))',
  				dark: 'hsl(var(--seal-warm-dark))'
  			},
  			paper: 'hsl(var(--paper-texture))',
  			ink: 'hsl(var(--ink))',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			},
  			'bounce-gentle': {
  				'0%, 100%': {
  					transform: 'translateY(0)'
  				},
  				'50%': {
  					transform: 'translateY(-12px)'
  				}
  			},
  			'float': {
  				'0%, 100%': {
  					transform: 'translateY(0) rotate(0deg)'
  				},
  				'50%': {
  					transform: 'translateY(-8px) rotate(2deg)'
  				}
  			},
  			'twinkle': {
  				'0%, 100%': {
  					opacity: '1',
  					transform: 'scale(1)'
  				},
  				'50%': {
  					opacity: '0.6',
  					transform: 'scale(0.9)'
  				}
  			},
  			'drift': {
  				'0%': {
  					transform: 'translateY(0) translateX(0) rotate(0deg)'
  				},
  				'33%': {
  					transform: 'translateY(-10px) translateX(5px) rotate(5deg)'
  				},
  				'66%': {
  					transform: 'translateY(-5px) translateX(-5px) rotate(-3deg)'
  				},
  				'100%': {
  					transform: 'translateY(0) translateX(0) rotate(0deg)'
  				}
  			},
  			'fade-in-up': {
  				'0%': {
  					opacity: '0',
  					transform: 'translateY(20px)'
  				},
  				'100%': {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			'bounce-gentle': 'bounce-gentle 2s ease-in-out infinite',
  			'float': 'float 3s ease-in-out infinite',
  			'twinkle': 'twinkle 2s ease-in-out infinite',
  			'drift': 'drift 6s ease-in-out infinite',
  			'fade-in-up': 'fade-in-up 0.6s ease-out forwards'
  		},
  		boxShadow: {
  			'envelope': '0 8px 30px -10px hsl(var(--envelope-shadow) / 0.4)',
  			'soft': '0 4px 20px -5px hsl(var(--pastel-sage) / 0.5)',
  			'dreamy': '0 10px 40px -10px hsl(var(--pastel-sage) / 0.3), 0 4px 15px -5px hsl(var(--pastel-mist) / 0.2)'
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
