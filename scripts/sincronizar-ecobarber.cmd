@echo off
REM Ponte automatica com o EcoBarber.
REM
REM Existe porque o agendador do Windows nao sabe em que pasta rodar: este
REM arquivo entra na pasta certa, roda a sincronizacao e guarda o que aconteceu
REM num registro, para dar para olhar depois sem precisar estar na frente.
REM
REM Agendado pelo Agendador de Tarefas do Windows como "Barbearia - sincronizar
REM EcoBarber". Para tirar do ar: schtasks /delete /tn "Barbearia - sincronizar EcoBarber" /f

REM chcp 65001: sem isto o registro sai com os acentos trocados e fica ruim de ler
chcp 65001 > nul

cd /d "%~dp0.."
if not exist "backups\ecobarber" mkdir "backups\ecobarber"
node scripts\sincronizar-ecobarber.mjs >> "backups\ecobarber\registro.txt" 2>&1
