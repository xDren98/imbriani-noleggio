window.FRONTEND_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbx8vOsfdliS4e5odoRMkvCwaWY7SowSkgtW0zTuvqDIu4R99sUEixlLSW7Y9MyvNWk/exec',
  TOKEN: 'imbriani_secret_2025',
  storage: { 
    CF: 'cf', 
    USER_DATA: 'user_data', 
    BOOKING_DRAFT: 'booking_draft' 
  },
  validation: { 
    MIN_AUTISTI: 1, 
    MAX_AUTISTI: 3,
    ORARI_VALIDI: ['08:00','12:00','16:00','20:00']
  },
  statiEmoji: { 
    'Da confermare': '⏳', 
    'Confermata': '✅', 
    'Annullata': '❌' 
  }
};
console.log('✅ FRONTEND_CONFIG loaded');