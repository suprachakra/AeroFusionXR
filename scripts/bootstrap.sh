#!/usr/bin/env bash
# bootstrap.sh: Create local k3s cluster and deploy dependencies for dev/testing
set -euo pipefail

echo "==> Installing k3s..."
curl -sfL https://get.k3s.io | INSTALL_K3S_VERSION="v1.27.4+k3s1" K3S_KUBECONFIG_MODE="644" sh -
echo "==> Waiting for k3s to be ready..."
kubectl wait node k3s-master --for condition=Ready --timeout=120s

echo "==> Deploying Calico for networking..."
kubectl apply -f https://docs.projectcalico.org/manifests/calico.yaml

echo "==> Applying sample manifests..."
kubectl apply -k ../k8s

echo "Bootstrap complete."
