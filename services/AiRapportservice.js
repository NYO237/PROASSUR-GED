// services/aiRapportService.js
// Extraction via Groq (llama-3.3-70b) — même approche que aiService.js existant
const Groq = require('groq-sdk');
const pdfParse = require('pdf-parse');

const client = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

function parseJson(raw) {
  if (typeof raw !== 'string') return raw;
  try {
    return JSON.parse(raw.replace(/```json/g, '').replace(/```/g, '').trim());
  } catch (e) { return null; }
}

function parseMontant(str) {
  if (!str && str !== 0) return 0;
  const s = String(str).trim();
  const neg = s.startsWith('-');
  const val = parseInt(s.replace(/\s/g, '').replace(/\./g, '').replace(',', '').replace('-', ''), 10) || 0;
  return neg ? -val : val;
}

// ── Analyse : Etat des Encaissements ─────────────────────────────────────────
async function analyserSituationEncaissements(pdfBuffer) {
  if (!client) throw new Error('GROQ_API_KEY absent du .env');

  const parsed = await pdfParse(pdfBuffer);
  const texte = parsed.text;

  console.log('[aiRapportService] Texte encaissements extrait :', texte.length, 'chars');

  if (!texte || texte.trim().length < 50) {
    throw new Error('Le PDF semble vide ou non-texte. Exportez depuis ORASS (pas via imprimante).');
  }

  const prompt = `
Tu analyses un document ORASS "Etat des Encaissements" de PROASSUR (Cameroun).

Ce document contient des encaissements regroupés par mode :
- "Encaiss./ Espéce" ou "Encaiss./Espèce" = espèces
- "Régl / Espèce" = règlements espèces (peut être négatif = ristournes)
- "Paiement Electronique" = électronique
- "VERS EN BANQUE" = versements banque (section VB)

À la fin du document il y a un récapitulatif avec les totaux par mode :
  Total encaissement par Encaiss./ Espéce :  [montant prime totale]  [montant prime encaissée]
  Total encaissement par Régl / Espèce :     [montant prime totale]  [montant prime encaissée]
  Total encaissement par Paiement Electronique : [montant]           [montant prime encaissée]

La ligne "TOTAL GENERAL" à la fin donne : TOTAL GENERAL [prime totale] [prime encaissée]

Extrais :
1. date_rapport : période du document "Du JJ/MM/YYYY Au JJ/MM/YYYY" → prends la date de début au format YYYY-MM-DD
2. total_especes : prime encaissée de la section "Encaiss./ Espéce" (2ème montant de la ligne Total)
3. total_regl_espece : prime encaissée de la section "Régl / Espèce" (peut être négatif)
4. total_electronique : prime encaissée de la section "Paiement Electronique"
5. total_general : le 2ème montant de "TOTAL GENERAL"

Les montants utilisent le format français : 639.650 = 639650, - 25.838 = -25838

Retourne UNIQUEMENT ce JSON valide, sans texte ni markdown :
{
  "date_rapport": "YYYY-MM-DD",
  "total_especes": 0,
  "total_regl_espece": 0,
  "total_electronique": 0,
  "total_general": 0
}

TEXTE DU DOCUMENT :
${texte}
`;

  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 300,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0].message.content;
  console.log('[aiRapportService] Groq encaissements :', raw);

  const data = parseJson(raw);
  if (!data) throw new Error('Réponse Groq non parseable : ' + raw);

  const resultat = {
    date_rapport:          data.date_rapport || null,
    total_especes:         parseMontant(data.total_especes),
    total_regl_espece:     parseMontant(data.total_regl_espece),
    total_electronique:    parseMontant(data.total_electronique),
    total_versement_banque: 0,
    total_general:         parseMontant(data.total_general),
    sur_emission: parseMontant(data.total_especes)
                + parseMontant(data.total_regl_espece)
                + parseMontant(data.total_electronique),
  };

  console.log('[aiRapportService] ✅ Résultat encaissements :', resultat);
  return resultat;
}

// ── Analyse : Bordereau de Règlement des Commissions ─────────────────────────
async function analyserBordereauCommissions(pdfBuffer) {
  if (!client) throw new Error('GROQ_API_KEY absent du .env');

  const parsed = await pdfParse(pdfBuffer);
  const texte = parsed.text;

  console.log('[aiRapportService] Texte commissions extrait :', texte.length, 'chars');

  if (!texte || texte.trim().length < 50) {
    throw new Error('PDF commissions vide ou non-texte.');
  }

  const prompt = `
Tu analyses un "BORDEREAU DE REGLEMENT DES COMMISSIONS" de PROASSUR (Cameroun).

Ce document contient un tableau de commissions à régler.
Cherche la ligne "Total Bordereau" qui donne la somme totale.
La dernière colonne "À Régler" de cette ligne = total_a_regler.
La date apparaît comme "Borderau Règlé, le : JJ/MM/YYYY" ou "Bordereau Validé le : JJ/MM/YYYY".
Le numéro est sous la forme "Bordereau No : XXXXXXXXXX/YYYY".
Les montants sont en format français : 34.788 = 34788

Retourne UNIQUEMENT ce JSON valide, sans texte ni markdown :
{
  "date_rapport": "YYYY-MM-DD",
  "numero_bordereau": "",
  "total_a_regler": 0
}

TEXTE DU DOCUMENT :
${texte}
`;

  const completion = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 200,
    response_format: { type: 'json_object' },
  });

  const raw = completion.choices[0].message.content;
  console.log('[aiRapportService] Groq commissions :', raw);

  const data = parseJson(raw);
  if (!data) throw new Error('Réponse Groq non parseable : ' + raw);

  const resultat = {
    date_rapport:     data.date_rapport || null,
    numero_bordereau: data.numero_bordereau || null,
    total_a_regler:   parseMontant(data.total_a_regler),
  };

  console.log('[aiRapportService] ✅ Résultat commissions :', resultat);
  return resultat;
}

module.exports = { analyserSituationEncaissements, analyserBordereauCommissions };