"""
Setup für SOLIDWORKS Connector Windows Service
"""
from setuptools import setup, find_packages

setup(
    name="solidworks-connector",
    version="1.0.0",
    description="SOLIDWORKS Connector Windows Service",
    packages=find_packages(),
    install_requires=[
        "fastapi==0.104.1",
        "uvicorn[standard]==0.24.0",
        "pydantic==2.5.0",
        "pywin32==306"
    ],
    entry_points={
        "console_scripts": [
            "solidworks-connector=src.main:main",
        ],
    },
)
