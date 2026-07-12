const contratsEmployeService = require('../services/ContratsEmployeService');

// GET /api/contrats-employe/rechercher?nom=...
async function rechercherContrats(req, res) {
    try {
        const nom = (req.query.nom || '').trim();

        if (!nom) {
            return res.status(400).json({
                success: false,
                message: "Veuillez saisir un nom à rechercher.",
            });
        }

        const contrats = await contratsEmployeService.rechercherContratsParNom(nom);

        return res.status(200).json({
            success: true,
            contrats,
        });

    } catch (error) {
        console.error("Erreur dans contratsEmployeController - rechercherContrats :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la recherche des contrats.",
        });
    }
}

// GET /api/contrats-employe/details/:id
async function obtenirDetailsContrat(req, res) {
    try {
        const idDocument = parseInt(req.params.id, 10);

        if (!idDocument || Number.isNaN(idDocument)) {
            return res.status(400).json({
                success: false,
                message: "Identifiant de contrat invalide.",
            });
        }

        const contrat = await contratsEmployeService.obtenirDetailsContrat(idDocument);

        if (!contrat) {
            return res.status(404).json({
                success: false,
                message: "Contrat introuvable.",
            });
        }

        return res.status(200).json({
            success: true,
            contrat,
        });

    } catch (error) {
        console.error("Erreur dans contratsEmployeController - obtenirDetailsContrat :", error);
        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la récupération des détails du contrat.",
        });
    }
}

module.exports = {
    rechercherContrats,
    obtenirDetailsContrat,
};