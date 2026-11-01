# ADR 0002 — Expo (React Native + TypeScript) para o app

- **Status**: Aceito
- **Data**: 2026-10-31

## Contexto

O MVP é um app Android (RNF-001) desenvolvido por uma pessoa no tempo livre, em TDD. É importante iterar rápido no celular real e ter tipagem forte para o contrato de dados.

## Decisão

Usar **Expo** com **TypeScript** e **expo-router**, testado com Jest + React Native Testing Library.

## Alternativas consideradas

| Opção | Prós | Contras |
|---|---|---|
| Expo / React Native (escolhida) | Teste no celular via Expo Go em minutos; TypeScript; ecossistema grande; builds sem Android Studio (EAS) | Camada extra sobre o nativo; algumas libs exigem dev build |
| Flutter | Ótimo desempenho e UI consistente; bons testes de widget | Dart (linguagem a mais para o autor); contrato não compartilha tipos com ferramentas JS |
| Kotlin nativo (Compose) | Máximo controle e desempenho no Android | Mais código por feature; iOS futuro exigiria reescrita |

## Consequências

- **Positivas**: ciclo rápido de desenvolvimento; um caminho para iOS no futuro sem reescrever.
- **Negativas / custos**: para notificações confiáveis e builds de release será preciso um dev build (EAS ou build local), não só o Expo Go.
- **O que fica mais difícil de mudar depois**: componentes de UI e navegação são específicos de React Native; o domínio (funções puras em TS) continua portável.
