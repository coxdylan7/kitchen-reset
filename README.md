# Kitchen Reset

Product foundation for a New York City marketplace that books trusted workers to restore a customer's kitchen: wash, dry, put away dishes, and reset the sink/counter area.

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
