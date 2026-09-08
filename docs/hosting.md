# Hosting and deployment

The public destination for the replacement site is:

```text
https://curation.apolloinrealtime.org
```

GitHub Actions runs the locked Python test suite on every pushed branch. The frontend job detects the future root React project by the presence of both `package.json` and `package-lock.json`. Until those files exist, it exits successfully without attempting a deployment.

Once the frontend exists, the workflow will:

1. use Node.js 24.11.1;
2. run `npm ci`, `npm run check`, and `npm run build`;
3. require a static build at `.local/dist/index.html`; and
4. deploy `.local/dist/` to DreamHost only for the `main` branch.

The repository configuration mirrors `../airt2` and expects these GitHub settings:

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `DREAMHOST_PRIVATE_KEY` | SSH private key used only by the deploy step |
| Variable | `DREAMHOST_HOST` | DreamHost SSH host |
| Variable | `DREAMHOST_USER` | DreamHost SSH user |
| Variable | `DREAMHOST_PATH_DEV` | Directory served for `curation.apolloinrealtime.org` |

The custom domain and DNS are managed outside this repository. The workflow does not print secret values or store the private key in Git configuration. Deployment uses `rsync --delete`, so the remote directory must be dedicated to this site.

When the React app is scaffolded, configure Vite to emit `.local/dist/`, as the reference project does. If the output path changes, update both the verification and deployment steps together.
