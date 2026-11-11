/* Reutiliza el flujo E2E de Fase II y conserva sus evidencias históricas. */
process.env.AGROVOZ_PHASE_III='1';
process.env.AGROVOZ_EVIDENCE_PREFIX='FASE_III';
require('./phase_ii_browser.cjs');
