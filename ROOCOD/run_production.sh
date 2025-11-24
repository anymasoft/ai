#!/bin/bash
gunicorn -w 4 -k sync -b 0.0.0.0:5000 SERVER_TEMPLATE:app
