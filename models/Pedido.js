const mongoose = require('mongoose');

const PedidosSchema = mongoose.Schema({
    pedido: {
        type: Array,
        required: true
    },
    total: {
        type: Number,
        required: true
    },
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Clientes'
    },
    vendedor: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        vendedor: 'Usuarios'
    },
    estado: {
        type: String,
        default: 'Pendiente'
    },
    creado: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model('Pedidos', PedidosSchema);