const { ApolloServer } = require('apollo-server');
const typeDefs = require('./db/schema');
const resolvers = require('./db/resolvers');
const conectarDB = require('./config/db');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

//connect database
conectarDB();

//inicialize server with schema and resolvers
const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: ({ req }) => {
        const token = req.headers['authorization'] || '';
        if (token) {
            try {
                const usuario = jwt.verify(token.replace('Bearer ', ''), process.env.SECRET_PASSWORD);
                return {
                    usuario
                }
            } catch (error) {
                return new Error(error);
            }
        }
    }
});

//run server
server.listen({ port: process.env.PORT || 4000 }).then(({ url }) => {
    console.log(`servidor listo en la url: ${url}`);
});