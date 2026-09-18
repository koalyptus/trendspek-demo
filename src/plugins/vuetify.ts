import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dark',
    themes: {
      dark: {
        dark: true,
        colors: {
          background: '#0B111E',
          surface: '#131D31',
          'surface-variant': '#1B273E',
          'surface-bright': '#24324E',
          'surface-light': '#324468',
          'on-surface': '#E2E8F0',
          'on-background': '#F8FAFC',
          primary: '#00D2B5',        // Trendspek signature cyan / teal
          'primary-darken-1': '#00A891',
          secondary: '#38BDF8',      // Precision sky blue
          'secondary-darken-1': '#0284C7',
          accent: '#818CF8',         // Violet / Indigo
          error: '#EF4444',          // Critical severity
          warning: '#F59E0B',        // High severity
          info: '#3B82F6',           // Medium severity
          success: '#10B981',        // Low severity / Synced / Resolved
          // Custom severity indicators
          'severity-critical': '#EF4444',
          'severity-high': '#F97316',
          'severity-medium': '#F59E0B',
          'severity-low': '#3B82F6'
        }
      }
    }
  }
})
