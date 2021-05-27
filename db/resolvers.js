const Usuarios = require('../models/Usuarios');
const Productos = require('../models/Producto');
const Cliente = require('../models/Cliente');
const Pedido = require('../models/Pedido');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: 'variables.env' });

const crearToken = (user, secret, expires) => {
    const { id, email, nombre, apellido } = user;

    return jwt.sign({ id, email, nombre, apellido }, secret, { expiresIn: expires });
}

//resolvers
const resolvers = {
    Query: {
        //usuarios
        obtenerUsuario: async (root, { }, context) => {
            return context.usuario;
        },
        //productos
        obtenerProductos: async () => {
            try {
                const productos = await Productos.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async (root, { id }) => {
            //validate if the product exists
            const producto = await Productos.findById(id);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }

            return producto;
        },
        //clientes
        obtenerClientes: async () => {
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesVendedor: async (root, { }, context) => {
            const { usuario } = context;
            try {
                const clientes = await Cliente.find({ vendedor: usuario.id.toString() });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (root, { id }, context) => {
            const { usuario } = context;
            //validate if the client exists
            const cliente = await Cliente.findById(id);
            if (!cliente) {
                throw new Error('Cliente no existe');
            }

            //can only see the client, who create it
            if (cliente.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no validas');
            }

            return cliente;
        },
        //pedidos
        obtenerPedidos: async () => {
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedidosVendedor: async (root, { }, context) => {
            try {
                const pedidos = await Pedido.find({ vendedor: context.usuario.id }).populate('cliente');
                return pedidos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerPedido: async (root, { id }, context) => {
            const { usuario } = context;
            const pedido = await Pedido.findById(id);
            //validate if the pedido exist
            if (!pedido) {
                throw new Error('Pedido no encontrado');
            }
            if (pedido.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no validas');
            }

            return pedido;
        },
        obtenerPedidosEstado: async (root, { estado }, context) => {
            const { usuario } = context;
            const pedidos = await Pedido.find({ vendedor: usuario.id, estado });
            return pedidos;
        },
        mejoresClientes: async () => {
            const clientes = await Pedido.aggregate([
                { $match: { estado: "Completado" } },
                {
                    $group: {
                        _id: "$cliente",
                        total: { $sum: "$total" }
                    }
                },
                {
                    $lookup: {
                        from: "clientes",
                        localField: "_id",
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                {
                    $limit: 10
                },
                {
                    $sort: {
                        total: -1
                    }
                }
            ]);
            return clientes;
        },
        mejoresVendedores: async () => {
            const vendedores = await Pedido.aggregate([
                { $match: { estado: "Completado" } },
                {
                    $group: {
                        _id: "$vendedor",
                        total: { $sum: "$total" }
                    }
                },
                {
                    $lookup: {
                        from: "usuarios",
                        localField: "_id",
                        foreignField: "_id",
                        as: "vendedor"
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: { total: -1 }
                }
            ]);

            console.log(vendedores)
            return vendedores;
        },
        buscarProducto: async (root, { texto }, context) => {
            const productos = await Productos.find({ $text: { $search: texto } }).limit(20);
            return productos;
        }
    },

    Mutation: {
        //usuarios
        nuevoUsuario: async (root, { input }) => {
            const { email, password } = input;

            //validate if the user exists
            const userExists = await Usuarios.findOne({ email });
            if (userExists) {
                throw new Error('El usuario ya está registrado');
            }

            //hash password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password, salt);

            //save user in database
            try {
                const usuario = new Usuarios(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        authenticarUsuario: async (root, { input }) => {
            const { email, password } = input;

            //validate if the user exists
            const userExists = await Usuarios.findOne({ email });
            if (!userExists) {
                throw new Error('El usuario no existe');
            }

            //validate if the password is correct
            const truePassword = await bcryptjs.compare(password, userExists.password);
            if (!truePassword) {
                throw new Error('Password Incorrecto');
            }

            //create a token 
            return {
                token: crearToken(userExists, process.env.SECRET_PASSWORD, '24h')
            }
        },
        //productos
        nuevoProducto: async (root, { input }) => {
            try {
                const producto = new Productos(input);
                //save to database
                const response = await producto.save();
                return response;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async (root, { id, input }) => {
            //validate if the product exists
            let producto = await Productos.findById(id);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }
            //save to database
            producto = await Productos.findOneAndUpdate({ _id: id }, input, { new: true });

            return producto;
        },
        eliminarProducto: async (root, { id }) => {
            //validate if the product exists
            let producto = await Productos.findById(id);
            if (!producto) {
                throw new Error('Producto no encontrado');
            }

            //delete product
            await Productos.findOneAndDelete({ _id: id });

            return "Producto eliminado correctamente"
        },
        //clientes
        nuevoCliente: async (root, { input }, context) => {
            const { email } = input;
            const { usuario } = context;
            const newCliente = new Cliente(input);

            //validate if the client is register
            const cliente = await Cliente.findOne({ email });
            if (cliente) {
                throw new Error('Cliente ya registrado');
            }

            //asign seller
            newCliente.vendedor = usuario.id;

            //save client in database
            try {
                const response = await newCliente.save();
                return response;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async (root, { id, input }, context) => {
            const { usuario } = context;
            //validate if the client exists
            let cliente = await Cliente.findById(id);
            if (!cliente) {
                throw new Error('Cliente no existe');
            }
            //validate if the seller is who edit
            if (cliente.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no validas');
            }
            //save client
            cliente = await Cliente.findOneAndUpdate({ _id: id }, input, { new: true });
            return cliente;
        },
        eliminarCliente: async (root, { id }, context) => {
            const { usuario } = context;
            //validate if the client exists
            let cliente = await Cliente.findById(id);

            if (!cliente) {
                throw new Error('Cliente no existe');
            }
            //validate if the seller is who edit
            if (cliente.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no validas');
            }
            //delete client
            await Cliente.findByIdAndDelete({ _id: id });
            return "Cliente eliminado";
        },
        //pedidos
        nuevoPedido: async (root, { input }, context) => {
            const { cliente } = input;

            //validate if the client exists
            let clienteExiste = await Cliente.findById(cliente);

            if (!clienteExiste) {
                throw new Error('Ese cliente no existe');
            }

            //verify if the client is of the sell
            if (clienteExiste.vendedor.toString() !== context.usuario.id) {
                throw new Error('Credenciales no válidas');
            }

            //view the enable stock
            for await (const articulo of input.pedido) {
                const { id } = articulo;
                const producto = await Productos.findById(id);

                if (articulo.cantidad > producto.existencia) {
                    throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                } else {
                    producto.existencia = producto.existencia - articulo.cantidad;
                    await producto.save();
                }
            }

            //create a new pedido
            const nuevoPedido = new Pedido(input);

            //asign sell
            nuevoPedido.vendedor = context.usuario.id;

            //save to database
            const response = await nuevoPedido.save();

            return response;

        },
        actualizarPedido: async (root, { id, input }, context) => {
            const { usuario } = context;
            const { cliente } = input;
            //validate if the pedido exist
            const pedidoExist = await Pedido.findById(id);
            if (!pedidoExist) {
                throw new Error('El pedido no existe');
            }

            //validate if the client exist
            const existeClient = await Cliente.findById(cliente);
            if (!existeClient) {
                throw new Error('Cliente no existe');
            }

            //validate if the client y pedido belong to sell
            if (existeClient.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no válidas');
            }

            //view the enable stock
            if (input.pedido) {
                for await (const articulo of input.pedido) {
                    const { id } = articulo;
                    const producto = await Productos.findById(id);

                    if (articulo.cantidad > producto.existencia) {
                        throw new Error(`El articulo: ${producto.nombre} excede la cantidad disponible`);
                    } else {
                        producto.existencia = producto.existencia - articulo.cantidad;
                        await producto.save();
                    }
                }
            }

            //save pedido
            const response = await Pedido.findOneAndUpdate({ _id: id }, input, { new: true });

            return response;

        },
        eliminarPedido: async (root, { id }, context) => {
            const { usuario } = context;
            //validate if the pedido existe
            const pedido = await Pedido.findById(id);
            if (!pedido) {
                throw new Error('El pedido no existe');
            }

            //validate if the seller is who deleted
            if (pedido.vendedor.toString() !== usuario.id) {
                throw new Error('Credenciales no válidas');
            }

            //delete pedido to database
            await Pedido.findByIdAndDelete({ _id: id });

            return "Pedido eliminado correctamente";
        }
    }
}

module.exports = resolvers;