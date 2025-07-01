#!/bin/bash

echo "🔧 Correction des erreurs ESLint pour SnapyBara..."

# Se placer dans le dossier snapybara-back
cd "$(dirname "$0")"

# Installer les types manquants si nécessaire
echo "📦 Vérification des dépendances..."
npm install --save-dev @types/express @types/multer

# Exécuter ESLint avec correction automatique
echo "🔍 Exécution d'ESLint avec correction automatique..."
npx eslint "src/**/*.ts" --fix

# Formater avec Prettier
echo "💅 Formatage avec Prettier..."
npx prettier --write "src/**/*.ts"

# Vérifier les types TypeScript
echo "📝 Vérification des types TypeScript..."
npx tsc --noEmit

echo "✅ Corrections terminées!"
echo ""
echo "Vous pouvez maintenant exécuter :"
echo "  npm run lint      - pour vérifier les erreurs restantes"
echo "  npm run start:dev - pour démarrer le serveur"
