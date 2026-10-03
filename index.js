const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const _ = require('lodash');

const usuariosBD = [];
const rutaPagina = path.join(__dirname, 'index.html');

function crearNuevoUsuario(nombre, correo) {
    if (typeof nombre !== 'string' || typeof correo !== 'string') {
        throw new Error('El nombre y el correo son obligatorios.');
    }

    const nombreFormateado = _.toLower(nombre.trim()).replace(
        /(^|[\s'-])(\p{L})/gu,
        (coincidencia, separador, letra) => separador + letra.toLocaleUpperCase('es')
    );
    const correoFormateado = _.toLower(correo.trim());
    if (!nombreFormateado || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoFormateado)) {
        throw new Error('Ingresa un nombre y un correo válidos.');
    }
    if (usuariosBD.some((usuario) => usuario.correo === correoFormateado)) {
        throw new Error('Ya existe un usuario con ese correo.');
    }

    const nuevoUsuario = {
        id: usuariosBD.length + 1,
        nombre: nombreFormateado,
        correo: correoFormateado,
        fechaRegistro: new Date().toISOString()
    };
    usuariosBD.push(nuevoUsuario);
    return nuevoUsuario;
}

function responderJson(respuesta, estado, datos) {
    respuesta.writeHead(estado, { 'Content-Type': 'application/json; charset=utf-8' });
    respuesta.end(JSON.stringify(datos));
}

const servidor = http.createServer((solicitud, respuesta) => {
    const ruta = new URL(solicitud.url, 'http://localhost').pathname;

    if (solicitud.method === 'GET' && ruta === '/') {
        fs.readFile(rutaPagina, (error, contenido) => {
            if (error) {
                respuesta.writeHead(500);
                respuesta.end('No se pudo cargar la página.');
                return;
            }
            respuesta.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            respuesta.end(contenido);
        });
        return;
    }

    if (solicitud.method === 'GET' && ruta === '/api/usuarios') {
        responderJson(respuesta, 200, usuariosBD);
        return;
    }

    if (solicitud.method === 'POST' && ruta === '/api/usuarios') {
        let cuerpo = '';
        solicitud.on('data', (fragmento) => {
            cuerpo += fragmento;
            if (cuerpo.length > 100_000) solicitud.destroy();
        });
        solicitud.on('end', () => {
            try {
                const datos = JSON.parse(cuerpo);
                const usuario = crearNuevoUsuario(datos.nombre, datos.correo);
                responderJson(respuesta, 201, usuario);
            } catch (error) {
                const esDuplicado = error.message === 'Ya existe un usuario con ese correo.';
                responderJson(respuesta, esDuplicado ? 409 : 400, { error: error.message });
            }
        });
        return;
    }

    responderJson(respuesta, 404, { error: 'Ruta no encontrada.' });
});
//cambios
if (require.main === module) {
    const puerto = Number(process.env.PORT) || 3000;
    servidor.listen(puerto, () => {
        console.log(`Gestión de usuarios disponible en http://localhost:${puerto}`);
    });
}

module.exports = { crearNuevoUsuario, servidor, usuariosBD };
