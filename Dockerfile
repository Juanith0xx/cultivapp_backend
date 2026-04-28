# Usamos una versión ligera de Node
FROM node:18-alpine

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos package.json e instalamos dependencias
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto de tu API
EXPOSE 5000

# Comando para iniciar (asumiendo que usas nodemon o node directo)
CMD ["npm", "run", "dev"]