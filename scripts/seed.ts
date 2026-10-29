/**
 * Seeds demo data into the three databases: 3 users with profiles, 40 items, likes and 2 collections.
 * It is safe to run many times: every document has a fixed id and is written with an upsert.
 *
 *   npm run seed
 *
 * The users match the users of tools/mock-oauth (alice, bob, carol). If you log in through
 * the mock provider afterwards, you get these same users, because login matches on the provider id.
 *
 * This script is a tool, not a service. It is the only place that writes to all three databases.
 */
import { mongo } from 'mongoose';

const MONGO_URI = process.env.MONGO_URI ?? 'mongodb://localhost:27017/?directConnection=true';
const AUTH_DB = process.env.AUTH_DB_NAME ?? 'contenthub_auth';
const PROFILE_DB = process.env.PROFILE_DB_NAME ?? 'contenthub_profiles';
const CATALOG_DB = process.env.CATALOG_DB_NAME ?? 'contenthub_catalog';

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

interface SeedUser {
  id: string;
  providerUserId: string;
  login: string;
  name: string;
  email: string;
  bio: string;
  location: string;
}

const USERS: SeedUser[] = [
  { id: '5eed00000000000000000001', providerUserId: '1001', login: 'alice', name: 'Alice Moroz', email: 'alice@example.com', bio: 'Backend engineer. Writes about MongoDB and Node.js.', location: 'Mykolaiv, Ukraine' },
  { id: '5eed00000000000000000002', providerUserId: '1002', login: 'bob', name: 'Bob Kovalenko', email: 'bob@example.com', bio: 'Full-stack developer. Likes TypeScript and clean APIs.', location: 'Lviv, Ukraine' },
  { id: '5eed00000000000000000003', providerUserId: '1003', login: 'carol', name: 'Carol Shevchenko', email: 'carol@example.com', bio: 'Platform engineer. Docker, CI and observability.', location: 'Kyiv, Ukraine' },
];

const TOPICS: Array<{ title: string; tags: string[] }> = [
  { title: 'Why keyset pagination beats skip', tags: ['mongodb', 'pagination', 'performance'] },
  { title: 'Designing unique indexes you can trust', tags: ['mongodb', 'indexes'] },
  { title: 'Transactions in MongoDB: when you really need them', tags: ['mongodb', 'transactions'] },
  { title: 'NestJS modules without the confusion', tags: ['nestjs', 'typescript'] },
  { title: 'Validating uploads by magic bytes', tags: ['security', 'nodejs', 'uploads'] },
  { title: 'Refresh token rotation explained', tags: ['security', 'auth', 'jwt'] },
  { title: 'OAuth2 authorization code flow step by step', tags: ['auth', 'oauth'] },
  { title: 'Domain-driven design for small teams', tags: ['ddd', 'architecture'] },
  { title: 'Testing use cases with in-memory repositories', tags: ['testing', 'ddd', 'typescript'] },
  { title: 'Docker compose for local development', tags: ['docker', 'devops'] },
  { title: 'A gateway in front of three services', tags: ['nginx', 'architecture', 'devops'] },
  { title: 'Aggregation pipelines: $group and $facet', tags: ['mongodb', 'aggregation'] },
  { title: 'Text search with MongoDB text indexes', tags: ['mongodb', 'search', 'indexes'] },
  { title: 'Error handling that clients can rely on', tags: ['api', 'nestjs'] },
  { title: 'Request ids and readable logs', tags: ['observability', 'nodejs'] },
  { title: 'Structuring a TypeScript monorepo', tags: ['typescript', 'monorepo'] },
  { title: 'Rate limiting basics for public APIs', tags: ['api', 'security'] },
  { title: 'Idempotent endpoints and retries', tags: ['api', 'architecture'] },
  { title: 'Swagger docs your teammates will actually read', tags: ['api', 'nestjs', 'documentation'] },
  { title: 'Mongoose or the native driver?', tags: ['mongodb', 'nodejs', 'mongoose'] },
];

const MODIFIERS = ['Part 1', 'Part 2', 'in practice', 'checklist', 'lessons learned'];

function pseudoRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function slugify(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function itemId(index: number): string {
  return `5eed1000${index.toString(16).padStart(16, '0')}`;
}

async function main(): Promise<void> {
  const client = new mongo.MongoClient(MONGO_URI);
  await client.connect();
  try {
    await seedAuth(client);
    await seedProfiles(client);
    await seedCatalog(client);
  } finally {
    await client.close();
  }
}

async function seedAuth(client: mongo.MongoClient): Promise<void> {
  const users = client.db(AUTH_DB).collection('users');
  for (const user of USERS) {
    await users.updateOne(
      { provider: 'github', providerUserId: user.providerUserId },
      {
        $set: { login: user.login, name: user.name, email: user.email, avatarUrl: null, lastLoginAt: new Date(NOW) },
        $setOnInsert: { _id: new mongo.ObjectId(user.id), createdAt: new Date(NOW - 90 * DAY_MS) },
      },
      { upsert: true },
    );
  }
  console.log(`auth: ${USERS.length} users`);
}

async function seedProfiles(client: mongo.MongoClient): Promise<void> {
  const profiles = client.db(PROFILE_DB).collection('profiles');
  for (const user of USERS) {
    await profiles.updateOne(
      { userId: user.id },
      {
        $set: {
          handle: user.login,
          displayName: user.name,
          bio: user.bio,
          location: user.location,
          links: [{ label: 'GitHub', url: `https://github.com/${user.login}` }],
          avatar: null,
          preferences: { theme: 'system', language: 'en', emailNotifications: true, publicProfile: true },
          updatedAt: new Date(NOW),
        },
        $setOnInsert: { _id: new mongo.ObjectId(user.id.replace('5eed0000', '5eed2000')), createdAt: new Date(NOW - 90 * DAY_MS) },
      },
      { upsert: true },
    );
  }
  console.log(`profiles: ${USERS.length} profiles`);
}

async function seedCatalog(client: mongo.MongoClient): Promise<void> {
  const db = client.db(CATALOG_DB);
  const random = pseudoRandom(42);
  const items = [];
  const likes = [];

  for (let index = 0; index < 40; index++) {
    const topic = TOPICS[index % TOPICS.length];
    const title = index < TOPICS.length ? topic.title : `${topic.title}, ${MODIFIERS[index % MODIFIERS.length]}`;
    const author = USERS[index % USERS.length];
    const createdAt = new Date(NOW - Math.floor(random() * 90) * DAY_MS - Math.floor(random() * DAY_MS));
    // 32 published, 5 drafts, 3 archived
    const status = index >= 37 ? 'archived' : index >= 32 ? 'draft' : 'published';
    const tags = index % 5 === 0 ? [...topic.tags, 'featured'] : topic.tags;

    const likers = status === 'published' ? USERS.filter((user) => user.id !== author.id && random() < 0.6) : [];
    for (const liker of likers) {
      likes.push({ itemId: new mongo.ObjectId(itemId(index)), userId: liker.id, createdAt: new Date(createdAt.getTime() + DAY_MS) });
    }

    items.push({
      _id: new mongo.ObjectId(itemId(index)),
      title,
      slug: `${slugify(title)}-${itemId(index).slice(-8)}`,
      body: `${title}. This is demo content for item ${index + 1}. It talks about ${topic.tags.join(', ')} and shows up in text search.`,
      tags,
      authorId: author.id,
      status,
      // The counter always equals the number of like documents, like the transaction keeps it.
      stats: { likes: likers.length, views: status === 'published' ? Math.floor(random() * 500) : 0 },
      createdAt,
      publishedAt: status === 'draft' ? null : new Date(createdAt.getTime() + 60 * 60 * 1000),
    });
  }

  const itemsCollection = db.collection('items');
  for (const item of items) {
    await itemsCollection.replaceOne({ _id: item._id }, item, { upsert: true });
  }
  const likesCollection = db.collection('likes');
  for (const like of likes) {
    await likesCollection.updateOne({ itemId: like.itemId, userId: like.userId }, { $setOnInsert: like }, { upsert: true });
  }

  const publishedIds = items.filter((item) => item.status === 'published').map((item) => item._id);
  const collections = [
    { _id: new mongo.ObjectId('5eed3000000000000000000a'), ownerId: USERS[0].id, name: 'MongoDB reading list', itemIds: publishedIds.slice(0, 8), createdAt: new Date(NOW - 20 * DAY_MS) },
    { _id: new mongo.ObjectId('5eed3000000000000000000b'), ownerId: USERS[1].id, name: 'Favourites', itemIds: [publishedIds[10], publishedIds[3], publishedIds[7], publishedIds[1], publishedIds[15]], createdAt: new Date(NOW - 5 * DAY_MS) },
  ];
  for (const collection of collections) {
    await db.collection('collections').replaceOne({ _id: collection._id }, collection, { upsert: true });
  }
  console.log(`catalog: ${items.length} items, ${likes.length} likes, ${collections.length} collections`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
