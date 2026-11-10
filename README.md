# ZIGSHOP — boutique en ligne

Première maquette fonctionnelle de la boutique ZIGSHOP (hommes et femmes), en français et en FCFA.

## Aperçu local
Ouvrir `index.html` dans un navigateur. La maquette comprend une page d'accueil responsive, des catégories, des produits d'exemple et un panier local.

## Activer la base de données (Supabase)
1. Créer un projet gratuit sur supabase.com.
2. SQL Editor → coller et exécuter tout `supabase/schema.sql` (tables, sécurité RLS, fonction de commande, produits d'exemple).
3. Project Settings → API : copier l'URL et la clé `anon` dans `config.js`.
4. Gérer produits (prix, stock, photos via `image_url`) et commandes dans Table Editor.
### Comptes clients
- Inscription / connexion par email + mot de passe (Supabase Auth). Le panier d'un invité est conservé, fusionné à la connexion et synchronisé en base : il suit le client d'un appareil à l'autre.
- Commander exige un compte ; les clients retrouvent leurs commandes dans « Mon compte ».
- Par défaut Supabase envoie un email de confirmation à l'inscription. Pour tester vite : Authentication → Providers → Email → désactiver « Confirm email ». Pour la production, gardez-le activé et configurez un expéditeur email (SMTP).
- Réexécutez `supabase/schema.sql` en entier si vous aviez déjà exécuté l'ancienne version.

Sans configuration, le site fonctionne en mode démonstration.

## Publication gratuite
1. Créer un nouveau dépôt GitHub nommé `zigshop`.
2. Ajouter les fichiers `index.html`, `styles.css`, `app.js` et le dossier `supabase`.
3. Dans Cloudflare Pages, créer un projet relié au dépôt GitHub.
4. Pour cette version statique, laisser la commande de build vide et choisir `.` (la racine du projet) comme répertoire de sortie.
5. Déployer. Cloudflare fournira une adresse gratuite en `pages.dev`.

## Avant une vraie ouverture
- Remplacer les produits, photos et prix d'exemple par les vrais articles.
- Configurer une base de données Supabase et les règles RLS.
- Mettre en place la création et le suivi des commandes côté serveur.
- Intégrer Wave et Orange Money via un prestataire/compte marchand compatible.
- Ne jamais placer une clé `service_role` ou un secret de paiement dans le navigateur.

Le paiement n'est pas activé dans cette maquette. Le bouton de commande l'indique explicitement.
