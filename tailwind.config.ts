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
        editorial: [
          'Playfair Display',
          'ui-serif',
          'Georgia',
          'serif'
        ],
        body: [
          'DM Sans',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
        ],
        signature: [
          'Dancing Script',
          'cursive'
        ],
        handwritten: [
          'Caveat',
          'cursive'
        ],
        serif: [
          'Playfair Display',
          'ui-serif',
          'Georgia',
          'serif'
        ],
        sans: [
          'DM Sans',
          'ui-sans-serif',
          'system-ui',
          'sans-serif'
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
        cream: {
          DEFAULT: 'hsl(var(--cream))',
          dark: 'hsl(var(--cream-dark))'
        },
        beige: 'hsl(var(--beige))',
        taupe: 'hsl(var(--taupe))',
        charcoal: 'hsl(var(--charcoal))',
        maroon: {
          DEFAULT: 'hsl(var(--maroon))',
          dark: 'hsl(var(--maroon-dark))'
        },
        'dusty-rose': 'hsl(var(--dusty-rose))',
        'gold-muted': 'hsl(var(--gold-muted))',
        envelope: {
          cream: 'hsl(var(--envelope-cream))',
          shadow: 'hsl(var(--envelope-shadow))'
        },
        seal: {
          DEFAULT: 'hsl(var(--seal-maroon))',
          dark: 'hsl(var(--seal-maroon-dark))'
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
        sm: 'calc(var(--radius) - 4px)',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem'
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' }
        },
        'bounce-gentle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' }
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0) rotate(0deg)' },
          '50%': { transform: 'translateY(-6px) rotate(1deg)' }
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'seal-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'bounce-gentle': 'bounce-gentle 2.5s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'seal-pulse': 'seal-pulse 2s ease-in-out infinite'
      },
      boxShadow: {
        'editorial': '0 2px 8px -2px hsl(var(--envelope-shadow) / 0.15)',
        'envelope': '0 8px 30px -10px hsl(var(--envelope-shadow) / 0.3)',
        'soft': '0 4px 20px -5px hsl(var(--envelope-shadow) / 0.15)',
        'dreamy': '0 10px 40px -10px hsl(var(--envelope-shadow) / 0.2), 0 4px 15px -5px hsl(var(--dusty-rose) / 0.1)'
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem'
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
