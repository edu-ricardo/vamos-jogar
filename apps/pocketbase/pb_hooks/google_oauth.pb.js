/// <reference path="../pb_data/types.d.ts" />

// Configura o login com Google a partir do ambiente a cada início. O client secret fica só no
// arquivo de configuração do servidor, nunca no repositório nem na imagem.
onBootstrap((e) => {
  e.next();

  const clientId = $os.getenv('GOOGLE_CLIENT_ID');
  const clientSecret = $os.getenv('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    console.log('Login com Google desativado: defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET');
    return;
  }

  const users = e.app.findCollectionByNameOrId('users');
  users.oauth2.enabled = true;
  users.oauth2.providers = [{ name: 'google', clientId: clientId, clientSecret: clientSecret }];
  e.app.save(users);
  console.log('Login com Google configurado');
});
