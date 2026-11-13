# Tokenlon MMSK

Market Maker Service Kit.

See [docs](/docs/index.md)

The smart contract files under the `/contracts` directory are intended for internal unit testing purposes. They have not undergone any formal auditing and are not recommended for use in any production environments.

## Security: restrict network access

The MMSK HTTP API has no authentication. A self-hosted MMSK instance should only be reachable from Tokenlon's servers (and your own market maker backend): put it behind a network allowlist (firewall / security group / reverse proxy) and never expose it to the public internet.

## Version Release

1. bump version in `package.json`, please follow [semantic versioning](https://semver.org/).
2. update server version response at `src/handler/version.ts`
3. commit above changes and git tag new version
4. run release script under `script` folder
5. upload tar file on github release page with writing change log

copyright© imToken PTE. LTD.
