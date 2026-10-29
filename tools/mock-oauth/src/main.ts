import { createMockOAuthApp, MOCK_USERS } from './app';

const port = Number.parseInt(process.env.MOCK_OAUTH_PORT ?? process.env.PORT ?? '9000', 10);

createMockOAuthApp().listen(port, () => {
  console.log(`mock-oauth listening on :${port}. Users: ${MOCK_USERS.map((user) => user.login).join(', ')}`);
});
