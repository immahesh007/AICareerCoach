#!/bin/sh
set -e
python migrate.py
python -c "
import logging
logging.basicConfig(level=logging.INFO)
log = logging.getLogger('preload')
log.info('Pre-loading embedding model...')
from services.ats_service import _get_model
_get_model()
log.info('BGE-M3 ready.')
"
exec uvicorn main:app --host 0.0.0.0 --port 8000
