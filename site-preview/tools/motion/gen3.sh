#!/bin/zsh
# usage: gen3.sh <shot> <seed> <prompt>  -> 25 frames (about one second) from the torso crop
set -e
T="/tmp/aha-video/toolchain"; P="$T/ltx-2-mlx/packages"
name=$1; seed=$2; prompt=$3; endw=${4:-0}; tag=${5:-}
export PYTHONUNBUFFERED=1 LTX2_VAE_DECODE_BUDGET_GB=8
export PYTHONPATH="$P/ltx-core-mlx/src:$P/ltx-pipelines-mlx/src"
mkdir -p /tmp/aha-video/raw; cd /tmp/aha-video/raw
endarg=""; [ "$endw" != "0" ] && endarg="--image /tmp/aha-video/torso/$name.jpg 24 $endw"
start=$(date +%s)
/usr/bin/caffeinate -i "$T/ltx-2-mlx/.venv/bin/python" -m ltx_pipelines_mlx.cli generate --distilled --low-ram --no-audio \
  --model "$T/models/ltx-2.3-q8" --gemma "$T/models/gemma-3-12b-4bit" \
  --image /tmp/aha-video/torso/$name.jpg 0 1.0 ${=endarg} \
  --prompt "$prompt" -W 768 -H 960 -f 25 --frame-rate 24 --seed $seed \
  -o /tmp/aha-video/raw/$name$tag.mp4
echo "ELAPSED $(( $(date +%s)-start ))s"
