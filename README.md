# Kitchen Reset

Product foundation for a tri-state marketplace that books trusted workers to restore a customer's kitchen: wash, dry, put away dishes, and reset the sink/counter area across selected regions in New York, New Jersey, and Connecticut.

Start with [the product framework](docs/product-framework.md). It is the source of truth for what belongs in the MVP. The photo-assessment rules are in [the AI intake rubric](docs/ai-intake-rubric.md).

## Working rule

Do not add a feature until it supports one of the MVP outcomes and its owner, success metric, and release stage are recorded in the framework.

## Deploying the prototype

The working prototype lives in [`app/`](app/). The repository includes a GitHub Pages workflow at [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml), which publishes the contents of `app/` whenever `main` is updated.

To create the GitHub repository and publish it for the first time:

```sh
gh auth login
gh repo create kitchen-reset --public --source=. --remote=origin
git push -u origin main
```

After the first push, GitHub Pages will deploy from the workflow. The deployment URL will be shown in the workflow run and under the repository's **Deployments** tab.

## Connecting Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run [`supabase/schema.sql`](supabase/schema.sql).
   If the project was already initialized before geographic availability was added, also run [`supabase/migrations/20260905_add_region_coordinates.sql`](supabase/migrations/20260905_add_region_coordinates.sql). This adds the latitude, longitude, and radius columns without deleting existing regions.
   To enable the Worker portal and open-job list on an existing project, also run [`supabase/migrations/20260905_add_worker_jobs.sql`](supabase/migrations/20260905_add_worker_jobs.sql).
3. Copy `app/config.example.js` to `app/config.js`.
4. Replace the URL and publishable/anon key in `app/config.js` using **Project Settings → Data API** and **API Keys**.
5. In Supabase **Authentication → URL Configuration**, add the GitHub Pages URL (for example `https://coxdylan7.github.io/kitchen-reset/`) to the allowed redirect URLs.
6. Commit and push `app/config.js` only if you have configured it as a deployment secret instead; never commit private service-role keys. For this static deployment, use a public publishable/anon key with the RLS policies in the schema.

The app uses magic-link email authentication. Once signed in, booking records and customer-uploaded photos are saved to Supabase. Without `config.js`, the UI remains usable as a local prototype and does not send data anywhere.
