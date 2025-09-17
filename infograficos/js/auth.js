// ================================
// Função de autenticação modular
// ================================
async function checkAccess(allowedRoles = [], onAuthorized = null) {
    const token = localStorage.getItem("token");
    if (!token) {
        Swal.fire({
            icon: 'warning',
            title: 'Token ausente',
            text: 'Você será redirecionado para o login.'
        }).then(() => {
            window.location.href = "../login.html";
        });
        return;
    }

    // Decodifica JWT sem verificar assinatura
    function parseJwt(token) {
        try {
            const base64Payload = token.split('.')[1];
            const payloadJson = atob(base64Payload);
            return JSON.parse(payloadJson);
        } catch (e) {
            return null;
        }
    }

    const payload = parseJwt(token);
    if (!payload) {
        Swal.fire({
            icon: 'error',
            title: 'Token inválido',
            text: 'Você será redirecionado para o login.'
        }).then(() => {
            localStorage.removeItem("token");
            window.location.href = "../login.html";
        });
        return;
    }

    // Verifica expiração
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
        Swal.fire({
            icon: 'warning',
            title: 'Token expirado',
            text: 'Por favor, faça login novamente.'
        }).then(() => {
            localStorage.removeItem("token");
            window.location.href = "../login.html";
        });
        return;
    }

    // Verifica role
    if (!allowedRoles.includes(payload.role)) {
        Swal.fire({
            icon: 'error',
            title: 'Acesso negado',
            text: 'Você não tem permissão para acessar esta página.'
        }).then(() => {
            localStorage.removeItem('token');
            window.location.href = "../login.html";
        });
        return;
    }

    // Valida token no backend (opcional, mas seguro)
    try {
        const response = await fetch("https://api-login-zmcb.onrender.com/perfil", {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!response.ok) throw new Error("Token inválido no backend");
        const data = await response.json();
        console.log("Usuário autorizado:", data.usuario, "Role:", data.setor);

        // Se forneceu callback, executa
        if (onAuthorized && typeof onAuthorized === "function") {
            onAuthorized(data);
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Erro no backend',
            text: 'Problema ao validar token. Você será redirecionado para login.'
        }).then(() => {
            localStorage.removeItem("token");
            window.location.href = "../login.html";
        });
        return;
    }

    return payload;
}
