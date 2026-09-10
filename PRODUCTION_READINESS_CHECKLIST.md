# Production readiness and go/no-go checklist

Use one copy per release. Enter **PASS**, **BLOCKED** or **N/A-approved**, plus an evidence link/path and owner. No blank or BLOCKED required item may remain when client data is enabled.

| Gate | Required evidence | Owner | Status |
|---|---|---|---|
| Named application, infrastructure, database, security/privacy, UAT and incident owners | Approved contact list and escalation rota |  |  |
| Windows Server 2022/2025 patched | OS build and patch screenshot/export |  |  |
| Capacity meets 4 CPU, 16 GiB RAM and disk forecast | VM specification and 12-month capacity estimate |  |  |
| Static IP, DNS and NAT correct | DNS lookup and network diagram |  |  |
| Only 80/443 public; RDP restricted; 3000/4000/5432 private | External port scan and firewall export |  |  |
| Valid HTTPS and renewal path tested | TLS report and certificate dates |  |  |
| PostgreSQL localhost-only and owned | `listen_addresses`, firewall and role evidence |  |  |
| Production secrets generated, vaulted and ACL-protected | Vault reference and redacted ACL output |  |  |
| MFA enforcement is `all` | Redacted environment check and login UAT |  |  |
| Two named administrators enrolled in MFA | Account/MFA status evidence |  |  |
| Admin password and MFA recovery tested | UAT result |  |  |
| Defender active, real-time and signatures <= 1 day | `Get-MpComputerStatus` output |  |  |
| Uploads fail closed when scanner is unavailable | Controlled UAT result |  |  |
| SMTP relay works without exposing credentials | Invitation/notification evidence |  |  |
| AI remains disabled or has separate legal/security approval | Environment evidence or signed AI approval |  |  |
| Locked dependency install, tests, typecheck and builds pass on target | `Build-Release.ps1` log |  |  |
| Database migrations current | `pnpm db:status` output |  |  |
| Synthetic end-to-end UAT passes | Signed UAT record |  |  |
| Off-server backup completes | Dump, document mirror, hash and timestamp |  |  |
| Backup platform provides versioned immutable/offline copy | Snapshot/immutability policy and test evidence |  |  |
| Restore rehearsal succeeds outside production | Restore log and verifier sign-off |  |  |
| RPO and RTO formally accepted | Signed values and risk owner |  |  |
| External probes and alerts reach the rota | Triggered test alert |  |  |
| Logs collected with defined retention and no secrets | SIEM query and retention policy |  |  |
| Data classification, residence, retention and deletion approved | Security/privacy approval |  |  |
| Client/contract permits this hosting model | Contract/legal confirmation |  |  |
| Incident, rollback and communications procedures rehearsed | Tabletop record |  |  |
| Single-VM availability risk accepted or HA implemented | Signed risk acceptance or HA test |  |  |
| Release hash and operator recorded | SHA-256, release ID, operator and date |  |  |

## Sign-off

| Role | Name | Decision | Date/time | Signature/reference |
|---|---|---|---|---|
| Application owner |  |  |  |  |
| Infrastructure owner |  |  |  |  |
| Security/privacy approver |  |  |  |  |
| UAT/business owner |  |  |  |  |
| Incident owner |  |  |  |  |

Final decision: **GO / NO-GO**  
Approved hostname:  
Approved release SHA-256:  
Accepted RPO:  
Accepted RTO:  
Initial authorised user group:  
