const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const demandeRoutes = require('./routes/demandeRoutes');
const profilRoutes = require('./routes/profilRoutes')
const scanRoutes = require('./routes/scanRoutes');
const utilisateursRoutes = require('./routes/utilisateursRoutes')
const contratsEmployeRoutes = require('./routes/contratsEmployeRoutes')
const notificationsRoutes = require('./routes/notificationsRoutes')

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const app = express();

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ressource statiques
app.use('/js', express.static(path.join(__dirname, 'public/js')));
app.use(express.static('images'));
app.use('/bootstrap-js', express.static(__dirname + '/node_modules/bootstrap/dist/js'));
app.use('/bootstrap-css', express.static(__dirname + '/node_modules/bootstrap/dist/css'));
app.use('/css',express.static(__dirname+'/public/css'))





// app.get('/',(req,res)=>{
//     res.redirect('/login')
// })
app.get('/',(req,res)=>{
    res.sendFile('./test.html',{root : __dirname})
})
app.get('/login',(req,res)=>{
   res.sendFile('./public/auth/login.html',{root : __dirname})
})
app.get('/register',(req,res)=>{
    res.sendFile('./public/auth/register.html',{root : __dirname})
 })

// API Authentification
app.use('/api/auth', authRoutes);
app.use('/api/demandes', demandeRoutes);
app.use('/api/profil',profilRoutes)
app.use('/api/scan', scanRoutes);
app.use('/api/production', require('./routes/productionRoutes'));
app.use('/api/utilisateurs',utilisateursRoutes)
app.use('/api/contrats-employe', contratsEmployeRoutes)
app.use('/api/statistiques', require('./routes/statistiquesRoutes'));
app.use('/api/notifications', notificationsRoutes);
// Ajoute cette ligne avec les autres routes API
app.use('/api/rapport-journalier', require('./routes/rapportJournalierRoutes'));
//SECTION EMPLOYE

app.get('/demandes_recues',(req,res)=>{
   res.sendFile('./public/employe/demandes_recues.html',{root : __dirname})
})

app.get('/scanner_dossier',(req,res)=>{
    res.sendFile('./public/employe/scanner_dossier.html',{root:__dirname})
})
app.get('/etat_production',(req,res)=>{
    res.sendFile('./public/employe/etat_production.html',{root:__dirname})
})
app.get('/etat_recettes',(req,res)=>{
    res.sendFile('./public/employe/etat_recettes.html',{root:__dirname})
})
app.get('/statistiques',(req,res)=>{
    res.sendFile('./public/employe/statistiques.html',{root:__dirname})
})
app.get('/utilisateurs',(req,res)=>{
    res.sendFile('./public/employe/utilisateurs.html',{root:__dirname})
})
app.get('/notifications',(req,res)=>{
    res.sendFile('./public/employe/notifications.html',{root:__dirname})
})
app.get('/contrats',(req,res)=>{
    res.sendFile('./public/employe/contrats.html',{root:__dirname})
})
app.get('/profil_proassur',(req,res)=>{
    res.sendFile('./public/employe/profil_proassur.html',{root:__dirname})
})
app.get('/etat_recettes', (req, res) => {
  res.sendFile('./public/employe/etat_recettes.html', { root: __dirname });
});
// (cette route existe déjà, rien à changer)




// SECTION CLIENT 

app.use('/api/contrats', require('./routes/Contratclientroutes'));

app.get('/accueil',(req,res)=>{
    res.sendFile('./public/client/accueil.html',{root : __dirname})
    
 })
app.get('/nouvelle_demande',(req,res)=>{
    res.sendFile('./public/client/nouvelle_demande.html',{root : __dirname})
 })
app.get('/suivi_demandes',(req,res)=>{
    res.sendFile('./public/client/suivi_demandes.html',{root : __dirname})
 })
app.get('/profil',(req,res)=>{
    res.sendFile('./public/client/profil.html',{root : __dirname})
 })
app.get('/mes_notifications',(req,res)=>{
    res.sendFile('./public/client/notifications.html',{root : __dirname})
 })



 // Exemple de ce à quoi doit ressembler votre route dans app.js ou votre routeur :


// app.listen(3000, 'localhost', () => {
//     console.log(`Serveur démarré sur ${process.env.HOST}:${process.env.PORT}`);
// });

app.listen(process.env.PORT, process.env.HOST, () => {
    console.log(`Serveur démarré sur ${process.env.HOST}:${process.env.PORT}`);
    console.log(`Serveur démarré sur http://${process.env.HOST}:${process.env.PORT}`);
});