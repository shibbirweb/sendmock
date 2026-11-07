---
title: Kubernetes
description: Run one shared SendMock in a Kubernetes cluster with the Helm chart, and point the cluster's apps at it.
---

> The chart is in [`packaging/helm/sendmock`](https://github.com/shibbirweb/sendmock/tree/develop/packaging/helm/sendmock). See [Docker](./docker.md) for Compose.

The Helm chart runs one SendMock for a team or a CI cluster: SMTP on port 1025, the web UI and API on 8025, health probes on `/api/v1/health`, as the image's non-root user with a read-only root file system.

## Install

1. Get the chart (from a clone of the repository):

   ```bash
   git clone https://github.com/shibbirweb/sendmock.git
   ```

2. Install it, keeping the data on a volume:

   ```bash
   helm install sendmock sendmock/packaging/helm/sendmock --set persistence.enabled=true
   ```

3. Reach the web UI from your machine:

   ```bash
   kubectl port-forward service/sendmock 8025:8025 1025:1025
   ```

4. Open http://127.0.0.1:8025.

## Point apps at it

Apps in the cluster send mail to `sendmock.<namespace>.svc` port `1025` and call the API at `http://sendmock.<namespace>.svc:8025/api/v1`. Provider SDKs (Twilio, SendGrid, FCM, ...) need the provider port: install with `--set providerPort.enabled=true` and use `http://sendmock.<namespace>.svc:8026` as their base URL.

## Values

| Value | Default | What it does |
| --- | --- | --- |
| `image.repository`, `image.tag` | `ghcr.io/shibbirweb/sendmock`, the chart's version | the image to run |
| `persistence.enabled`, `persistence.size`, `persistence.storageClass` | `false`, `1Gi`, the cluster's default | keeps `/data` on a PersistentVolumeClaim; off, it lives in an `emptyDir` and goes with the pod |
| `providerPort.enabled`, `providerPort.port` | `false`, `8026` | the provider port, on the Service too |
| `env` | none | any `SENDMOCK_*` setting, for example `--set env.SENDMOCK_MAX_EMAILS=5000` ([Configuration](../configuration.md)) |
| `ingress.enabled`, `ingress.host`, `ingress.className`, `ingress.tls` | `false`, `sendmock.local` | the web UI and API through an Ingress |
| `service.type`, `service.httpPort`, `service.smtpPort` | `ClusterIP`, `8025`, `1025` | how the Service is exposed |
| `resources`, `nodeSelector`, `tolerations`, `affinity`, `podAnnotations` | none | the usual pod settings |

SendMock keeps its data in one SQLite database, so the chart runs one replica and replaces it on upgrade (the old pod stops first).
