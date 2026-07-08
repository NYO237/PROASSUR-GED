const contratsEmployeService = require('../services/contratsEmployeService');

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

module.exports = {
    rechercherContrats,
};