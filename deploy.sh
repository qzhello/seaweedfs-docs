#!/bin/bash

set -e

# Check if nodejs is installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found, installing..."
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo yum install -y nodejs
else
    echo "Node.js is already installed: $(node --version)"
fi

# Verify npx is available
if ! command -v npx &> /dev/null; then
    echo "npx not found, installing nodejs npm tools..."
    sudo yum install -y npm
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Extract docs
echo "Extracting documentation..."
npm run extract-docs

# Build the project
echo "Building project..."
npm run build

# Create start.sh
cat > start.sh << 'EOF'
#!/bin/bash
npx serve dist
EOF
chmod +x start.sh

# Copy start.sh to dist
cp start.sh dist/

echo "Deployment ready! Run ./start.sh to start the server"
